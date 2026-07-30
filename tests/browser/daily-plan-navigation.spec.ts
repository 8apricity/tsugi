import { expect, test, type Locator } from '@playwright/test'

test.describe('Daily Plan date navigation', () => {
  test('desktop buttons animate one day at a time', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'webkit-iphone')
    await page.goto('/')

    const title = page.getByRole('heading', { level: 1 })
    const initialTitle = await title.textContent()
    const next = page.getByRole('button', { name: '次の日' })

    await expect(next).toBeVisible()
    await next.click()
    await expect(page.locator('.daily-plan-swipe-frame'))
      .toHaveAttribute('data-motion', 'settling')
    await expect(title).not.toHaveText(initialTitle ?? '')
  })

  test('reduced motion keeps desktop navigation without settling animation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'webkit-iphone')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const title = page.getByRole('heading', { level: 1 })
    const initialTitle = await title.textContent()
    await page.getByRole('button', { name: '次の日' }).click()

    await expect(page.locator('.daily-plan-swipe-frame'))
      .toHaveAttribute('data-motion', 'idle')
    await expect(title).not.toHaveText(initialTitle ?? '')
  })

  test('mobile vertical scrolling wins before a deliberate horizontal swipe', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit-iphone')
    await page.goto('/')
    await expect(page.locator('.period-inspect-button').first()).toBeVisible()
    await page.waitForTimeout(500)

    const title = page.getByRole('heading', { level: 1 })
    const initialTitle = await title.textContent()
    const surface = page.locator('.daily-plan-swipe-frame')

    await pointer(surface, 'pointerdown', 260, 260)
    await page.waitForTimeout(16)
    await pointer(surface, 'pointermove', 257, 274)
    await page.waitForTimeout(20)
    await pointer(surface, 'pointermove', 256, 300)
    await pointer(surface, 'pointerup', 256, 300)
    await expect(title).toHaveText(initialTitle ?? '')

    await pointer(surface, 'pointerdown', 12, 260)
    await pointer(surface, 'pointermove', 150, 258)
    await pointer(surface, 'pointerup', 200, 258)
    await expect(title).toHaveText(initialTitle ?? '')

    await pointer(surface, 'pointerdown', 300, 260)
    await pointer(surface, 'pointermove', 280, 258)
    await page.waitForTimeout(120)
    await pointer(surface, 'pointerup', 280, 258)
    await expect(surface).toHaveAttribute('data-motion', 'settling')
    await expect(surface).toHaveAttribute('data-motion', 'idle')
    await expect(title).toHaveText(initialTitle ?? '')

    await pointer(surface, 'pointerdown', 300, 260)
    await page.waitForTimeout(16)
    await pointer(surface, 'pointermove', 282, 286)
    await page.waitForTimeout(20)
    await pointer(surface, 'pointermove', 250, 256)
    await expect(surface).toHaveAttribute('data-motion', 'dragging')
    await expect(surface.locator('.daily-plan-swipe-preview .panel').first())
      .toBeAttached()
    await page.waitForTimeout(20)
    await pointer(surface, 'pointermove', 170, 254)
    await pointer(surface, 'pointerup', 150, 254)
    await expect(title).not.toHaveText(initialTitle ?? '')
  })

  test('closing the timetable dialog returns to its displayed date', async ({
    page,
  }) => {
    await page.goto('/')

    const period = page.locator('.period-inspect-button').first()
    const initialDate = await period.getAttribute('data-school-date')
    expect(initialDate).not.toBeNull()
    await page.getByRole('button', { name: /^1限/ }).click()
    let dialog = page.getByRole('dialog', { name: '時間割の変更状況' })
    const surface = page.locator('.daily-plan-swipe-frame')

    await pointer(surface, 'pointerdown', 300, 260)
    await pointer(surface, 'pointermove', 160, 258)
    await pointer(surface, 'pointerup', 140, 258)
    await dialog.getByRole('button', { name: '閉じる' }).click()
    await expect(period).toHaveAttribute('data-school-date', initialDate!)

    await page.getByRole('button', { name: /^1限/ }).click()
    dialog = page.getByRole('dialog', { name: '時間割の変更状況' })
    const date = dialog.getByRole('textbox', { name: '変更対象日' })
    const targetDate = shiftDate(await date.inputValue(), 2)

    await date.fill(targetDate)
    await page.goBack()

    await expect(period).toHaveAttribute('data-school-date', targetDate)
  })

  test('saved Task and Note date changes return to their new Daily Plans', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000)
    const suffix = `${testInfo.project.name}-${Date.now()}`
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const period = page.locator('.period-inspect-button').first()
    const initialDate = await period.getAttribute('data-school-date')
    expect(initialDate).not.toBeNull()

    const taskDate = shiftDate(initialDate!, 2)
    await page.getByRole('button', { name: 'タスクを追加' }).click()
    const taskDialog = page.getByRole('dialog', { name: 'タスクを追加' })
    await taskDialog.getByRole('textbox', { name: 'タイトル' })
      .fill(`移動タスク-${suffix}`)
    await taskDialog.getByRole('textbox', { name: '期限', exact: true })
      .fill(taskDate)
    await taskDialog.getByLabel('変更適用範囲').selectOption('class')
    await taskDialog.getByRole('button', { name: '下書きを保存' }).click()
    await expect(period).toHaveAttribute('data-school-date', taskDate)

    const noteDate = shiftDate(taskDate, 2)
    await page.getByRole('button', { name: 'ノートを追加' }).click()
    const noteDialog = page.getByRole('dialog', { name: 'ノートを追加' })
    await noteDialog.getByRole('textbox', { name: '本文' })
      .fill(`移動ノート-${suffix}`)
    await noteDialog.locator('input[type="date"]').fill(noteDate)
    await noteDialog.getByLabel('変更適用範囲').selectOption('class')
    await noteDialog.getByRole('button', { name: '下書きを保存' }).click()
    await expect(period).toHaveAttribute('data-school-date', noteDate)
  })

  test('date edits opened from change review return to change review', async ({
    page,
  }, testInfo) => {
    const suffix = `${testInfo.project.name}-${Date.now()}`
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()

    await page.getByRole('button', { name: 'タスクを追加' }).click()
    const taskDialog = page.getByRole('dialog', { name: 'タスクを追加' })
    await taskDialog.getByRole('textbox', { name: 'タイトル' })
      .fill(`確認内タスク-${suffix}`)
    await taskDialog.getByLabel('変更適用範囲').selectOption('class')
    await taskDialog.getByRole('button', { name: '下書きを保存' }).click()

    await page.getByRole('button', { name: '変更を反映（1）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    const cancellationRow = review.locator('.draft-cancellation-row').first()
    await pointer(cancellationRow, 'pointerdown', 260, 300)
    await page.waitForTimeout(16)
    await pointer(cancellationRow, 'pointermove', 257, 314)
    await page.waitForTimeout(20)
    await pointer(cancellationRow, 'pointermove', 256, 340)
    await pointer(cancellationRow, 'pointerup', 256, 340)
    await expect(cancellationRow).toHaveAttribute(
      'data-cancellation-open',
      'false',
    )

    await pointer(cancellationRow, 'pointerdown', 300, 300)
    await page.waitForTimeout(24)
    await pointer(cancellationRow, 'pointermove', 282, 298)
    await page.waitForTimeout(24)
    await pointer(cancellationRow, 'pointermove', 220, 296)
    await pointer(cancellationRow, 'pointerup', 220, 296)
    await expect(cancellationRow).toHaveAttribute(
      'data-cancellation-open',
      'true',
    )

    await pointer(cancellationRow, 'pointerdown', 220, 300)
    await page.waitForTimeout(24)
    await pointer(cancellationRow, 'pointermove', 242, 298)
    await page.waitForTimeout(24)
    await pointer(cancellationRow, 'pointermove', 300, 296)
    await pointer(cancellationRow, 'pointerup', 300, 296)
    await expect(cancellationRow).toHaveAttribute(
      'data-cancellation-open',
      'false',
    )

    await review.getByRole('button', { name: new RegExp(`確認内タスク-${suffix}`) })
      .click()
    const draftEditor = page.getByRole('dialog', { name: 'タスクを追加' })
    const dueDate = draftEditor.getByRole('textbox', {
      name: '期限',
      exact: true,
    })
    const currentDueDate = await dueDate.inputValue()
    await dueDate.fill(shiftDate(currentDueDate, 1))
    await draftEditor.getByRole('button', { name: '下書きを保存' }).click()

    await expect(review).toBeVisible()
  })
})

async function pointer(
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
) {
  await target.dispatchEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
  })
}

function shiftDate(schoolDate: string, days: number) {
  const date = new Date(`${schoolDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
