import { expect, test, type Page } from '@playwright/test'

test.describe('authenticated Direct Change review', () => {
  test('shows one fixed review header and disables an empty batch', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await page.getByRole('button', { name: '変更を反映（0）' }).click()

    const review = page.getByRole('dialog', { name: '変更を反映' })
    const header = review.locator('.editor-dialog-header')
    await expect(header.getByRole('button', { name: '戻る' })).toHaveText('‹')
    await expect(header.getByRole('button', { name: '確定' })).toBeDisabled()
    await expect(page.getByRole('dialog', { name: '最終確認' })).toHaveCount(0)

    await header.getByRole('button', { name: '戻る' }).click()
    await expect(review).toHaveCount(0)
    await expect(page.getByRole('button', { name: '変更を反映（0）' }))
      .toBeVisible()
  })

  test('keeps a long batch and editing mode after rejection', async ({
    page,
  }) => {
    await page.route('**/api/shared-information/direct-changes', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'rejected' }),
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const title = `review-failure-${Date.now()}`
    await saveTaskWithNotes(page, title, 12)

    await page.getByRole('button', { name: '変更を反映（13）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    const header = review.locator('.editor-dialog-header')
    const body = review.locator('.change-content-body')
    const headerY = (await header.boundingBox())?.y
    const bodyScroll = await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      }
    })
    expect(bodyScroll.scrollHeight).toBeGreaterThan(bodyScroll.clientHeight)
    expect(bodyScroll.scrollTop).toBeGreaterThan(0)
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(headerY)

    await header.getByRole('button', { name: '確定' }).click()
    await expect(review).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: '編集中' }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '変更を反映（13）' }))
      .toBeVisible()
    await expect(page.locator('.task-draft').filter({ hasText: title }))
      .toBeVisible()
    await expect(page.getByText(
      '変更を反映できませんでした。もう一度お試しください。',
      { exact: true },
    )).toBeVisible()
  })

  test('previews mixed drafts with Daily Plan card presentation', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTimetableChange(page)
    const title = `review-cards-${Date.now()}`
    await saveTaskWithNotes(page, title, 1)

    await page.getByRole('button', { name: '変更を反映（3）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    const timetablePreview = review.getByRole('button', { name: /月3/ })
    await expect(timetablePreview).toContainText('月3')
    await expect(timetablePreview).toContainText('3組')
    await expect(timetablePreview).toContainText('追加予定')

    const taskPreview = review.getByRole('button', {
      name: new RegExp(title),
    })
    await expect(taskPreview).toContainText('追加予定')
    await expect(review.getByRole('button', { name: /review note 1/ }))
      .toBeVisible()
    await expect(review.getByText('変更前', { exact: true })).toHaveCount(0)
    await expect(review.getByText('変更後', { exact: true })).toHaveCount(0)
  })

  test('shows the related school date on a school-date Note', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await page.getByRole('button', { name: 'ノートを追加' }).click()
    const editor = page.getByRole('dialog', { name: 'ノートを追加' })
    const body = `review-school-date-note-${Date.now()}`
    await editor.getByRole('textbox', { name: '本文' }).fill(body)
    await editor.getByRole('combobox', { name: '変更適用範囲' })
      .selectOption('class')
    const schoolDate = await editor.locator('input[type="date"]').inputValue()
    const [, month, day] = schoolDate.split('-').map(Number)
    await editor.getByRole('button', { name: '下書きを保存' }).click()

    await page.getByRole('button', { name: '変更を反映（1）' }).click()
    const notePreview = page.getByRole('dialog', { name: '変更を反映' })
      .getByRole('button', { name: new RegExp(body) })
    await expect(notePreview).toContainText(`${month}月${day}日`)
  })

  test('disables confirmation after a remote conflict', async ({ page }) => {
    await page.route('**/api/shared-information/direct-changes', async (route) => {
      const payload = route.request().postDataJSON() as {
        changes: Array<{ sourceId: string }>
      }
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'idempotency-conflict',
          conflictingKeys: [],
          conflictingSourceIds: [payload.changes[0].sourceId],
        }),
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTaskWithNotes(page, `review-a-conflict-${Date.now()}`, 0)
    await saveTaskWithNotes(page, `review-z-valid-${Date.now()}`, 0)

    await page.getByRole('button', { name: '変更を反映（2）' }).click()
    await page.getByRole('dialog', { name: '変更を反映' })
      .getByRole('button', { name: '確定' })
      .click()

    await page.getByRole('button', { name: '変更を反映（2）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    await expect(review.getByRole('button', { name: '確定' })).toBeDisabled()
    await expect(review.getByRole('alert')).toContainText(
      'ほかの変更と重なっている下書きがあります。',
    )

    const conflictCancel = review.locator('.change-content-conflicted')
      .locator(':scope > .draft-cancellation-row')
      .getByRole('button', { name: '下書きを取り消す' })
    await conflictCancel.focus()
    await page.keyboard.press('Enter')

    await expect(review.getByRole('alert')).toHaveCount(0)
    await expect(review.getByText('下書き 1件', { exact: true })).toBeVisible()
    await expect(review.getByRole('button', { name: '確定' })).toBeEnabled()
  })

  test('cancels Task groups by pointer and restores keyboard focus after Note cancellation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium')
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const groupedTitle = `review-a-group-cancel-${Date.now()}`
    const remainingTitle = `review-z-focus-${Date.now()}`
    await saveTaskWithNotes(page, groupedTitle, 1)
    await saveTaskWithNotes(page, remainingTitle, 2)

    await page.getByRole('button', { name: '変更を反映（5）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    const groupedTask = review.locator('[data-change-content-kind="task"]')
      .filter({ hasText: groupedTitle })
    const groupedRow = groupedTask.locator(
      ':scope > .draft-cancellation-row',
    )
    const groupedEdit = groupedRow.getByRole('button', {
      name: new RegExp(groupedTitle),
    })
    const groupedCancel = groupedRow.getByRole('button', {
      name: '下書きを取り消す',
    })

    await groupedEdit.hover()
    await expect(groupedCancel).toHaveCSS('opacity', '1')
    await groupedCancel.click()
    await expect(review.getByText(groupedTitle)).toHaveCount(0)
    await expect(review.getByText('review note 1', { exact: true }))
      .toHaveCount(1)
    await expect(review.getByText('下書き 3件', { exact: true })).toBeVisible()
    await expect(review.getByRole('button', {
      name: new RegExp(remainingTitle),
    })).toBeFocused()

    const firstNoteRow = review.locator('[data-draft-cancellation-id]')
      .filter({ hasText: 'review note 1' })
    const firstNote = firstNoteRow.getByRole('button', {
      name: /review note 1/,
    })
    await firstNote.focus()
    await page.keyboard.press('Tab')
    const noteCancel = firstNoteRow.getByRole('button', {
      name: '下書きを取り消す',
    })
    await expect(noteCancel).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(review.getByText('review note 1', { exact: true }))
      .toHaveCount(0)
    await expect(review.getByText(remainingTitle)).toBeVisible()
    await expect(review.getByRole('button', { name: /review note 2/ }))
      .toBeFocused()
  })

  test('reveals one mobile cancellation action without stealing vertical intent or row taps', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit-iphone')
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const timestamp = Date.now()
    const title = `review-a-swipe-${timestamp}`
    const otherTitle = `review-z-other-${timestamp}`
    await saveTaskWithNotes(page, title, 0)
    await saveTaskWithNotes(page, otherTitle, 0)
    await page.getByRole('button', { name: '変更を反映（2）' }).click()

    const review = page.getByRole('dialog', { name: '変更を反映' })
    const row = review.locator('[data-draft-cancellation-id]').filter({
      hasText: title,
    })
    const cancel = row.getByRole('button', { name: '下書きを取り消す' })
    const edit = row.getByRole('button', { name: new RegExp(title) })
    const otherRow = review.locator('[data-draft-cancellation-id]').filter({
      hasText: otherTitle,
    })
    const otherCancel = otherRow.getByRole('button', {
      name: '下書きを取り消す',
    })
    const otherEdit = otherRow.getByRole('button', {
      name: new RegExp(otherTitle),
    })

    await dispatchTouchPointer(row, [
      { x: 220, y: 80 },
      { x: 200, y: 83 },
    ])
    await expect(row).not.toHaveAttribute('data-cancellation-open', 'true')

    await edit.tap()
    const draftEditor = page.getByRole('dialog', { name: 'タスクを追加' })
    await expect(draftEditor).toBeVisible()
    await draftEditor.getByRole('button', { name: '戻る' }).click()
    await expect(review).toBeVisible()

    const verticalMovePrevented = await dispatchTouchPointer(row, [
      { x: 220, y: 80 },
      { x: 216, y: 120 },
    ])
    expect(verticalMovePrevented).toBe(false)
    await expect(row).not.toHaveAttribute('data-cancellation-open', 'true')

    await dispatchTouchPointer(row, [
      { x: 220, y: 80 },
      { x: 170, y: 82 },
    ])
    await expect(row).toHaveAttribute('data-cancellation-open', 'true')
    await expect(cancel).toHaveAttribute('aria-label', '下書きを取り消す')

    await otherEdit.tap()
    await expect(row).not.toHaveAttribute('data-cancellation-open', 'true')
    await expect(page.getByRole('dialog', { name: 'タスクを追加' }))
      .toHaveCount(0)

    await dispatchTouchPointer(row, [
      { x: 220, y: 80 },
      { x: 170, y: 82 },
    ])
    await edit.tap()
    await expect(row).not.toHaveAttribute('data-cancellation-open', 'true')
    await expect(page.getByRole('dialog', { name: 'タスクを追加' }))
      .toHaveCount(0)

    await dispatchTouchPointer(row, [
      { x: 220, y: 80 },
      { x: 160, y: 81 },
    ])
    await cancel.tap()
    await expect(review.getByText(title)).toHaveCount(0)
    await expect(otherEdit).toBeFocused()
    await expect(review.getByText('下書き 1件', { exact: true })).toBeVisible()

    await dispatchTouchPointer(otherRow, [
      { x: 220, y: 80 },
      { x: 160, y: 81 },
    ])
    await otherCancel.tap()
    await expect(review.getByText(otherTitle)).toHaveCount(0)
    await expect(review.getByText('変更内容はありません。')).toBeVisible()
    await expect(review.getByRole('button', { name: '確定' })).toBeDisabled()
    await expect(review.getByRole('button', { name: '戻る' })).toBeFocused()
  })

  test('submits one mixed batch and exposes a stale-refresh recovery', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    let submissionCount = 0
    let submittedChanges: Array<Record<string, unknown>> = []
    let failDailyPlanReload = false

    await page.route('**/api/daily-plans?*', async (route) => {
      if (!failDailyPlanReload) {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error' }),
      })
    })
    await page.route('**/api/shared-information/direct-changes', async (route) => {
      submissionCount += 1
      const payload = route.request().postDataJSON() as {
        changes: Array<Record<string, unknown>>
      }
      submittedChanges = payload.changes
      failDailyPlanReload = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'applied' }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTimetableChange(page)
    await saveTaskWithNotes(page, `review-mixed-${Date.now()}`, 1)

    await page.getByRole('button', { name: '変更を反映（3）' }).click()
    await page.getByRole('dialog', { name: '変更を反映' })
      .getByRole('button', { name: '確定' })
      .click()

    await expect.poll(() => submissionCount).toBe(1)
    expect(submittedChanges).toHaveLength(3)
    expect(submittedChanges.map((change) => change.kind ?? 'timetable'))
      .toEqual(['timetable', 'task', 'note'])
    await expect(page.getByRole('status').filter({
      hasText: '変更は反映されましたが、最新の表示を読み込めませんでした。',
    })).toBeVisible()
    await expect(page.locator('.timetable-editor-toast')
      .getByRole('button', { name: '再読み込み' })).toBeVisible()
    await expect(page.getByRole('button', { name: /変更を反映/ }))
      .toHaveCount(0)
  })
})

async function saveTaskWithNotes(
  page: Page,
  title: string,
  noteCount: number,
) {
  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const editor = page.getByRole('dialog', { name: 'タスクを追加' })
  await editor.getByRole('textbox', { name: 'タイトル' }).fill(title)
  await editor.getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('class')
  for (let index = 0; index < noteCount; index += 1) {
    await editor.getByRole('button', { name: '＋ノートを追加' }).click()
    await editor.getByRole('textbox', { name: `ノート本文 ${index + 1}` })
      .fill(`review note ${index + 1}`)
  }
  await editor.getByRole('button', { name: '下書きを保存' }).click()
}

async function saveTimetableChange(page: Page) {
  await page.getByRole('button', { name: /^1限/ }).click()
  const layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  const editor = page.getByRole('dialog', { name: '時間割変更' })
  const includeChange = editor.getByRole('checkbox', {
    name: '時間割も変更する',
  })
  if (!(await includeChange.isChecked())) await includeChange.check()
  await editor.getByRole('button', { name: '月3', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
}

async function dispatchTouchPointer(
  locator: ReturnType<Page['locator']>,
  points: Array<{ x: number; y: number }>,
) {
  return locator.evaluate((element, touchPoints) => {
    const pointerId = 67
    const dispatch = (
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      point: { x: number; y: number },
    ) => {
      const PointerEventConstructor =
        element.ownerDocument.defaultView!.PointerEvent
      const event = new PointerEventConstructor(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: 'touch',
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    }
    dispatch('pointerdown', touchPoints[0])
    let movePrevented = false
    for (const point of touchPoints.slice(1)) {
      movePrevented = dispatch('pointermove', point) || movePrevented
    }
    dispatch('pointerup', touchPoints.at(-1)!)
    return movePrevented
  }, points)
}
