import {
  devices,
  expect,
  test,
  type Browser,
  type Locator,
} from '@playwright/test'

test.describe('Daily Plan date navigation', () => {
  test('spaces adjacent days by twice the page edge padding', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('.daily-plan-swipe-track')).toBeAttached()

    const spacing = await page.evaluate<{
      dayGap: number
      pageEdgePadding: number
    }>(`
      (() => {
        const track = document.querySelector('.daily-plan-swipe-track')
        const shell = document.querySelector('.daily-plan-shell')
        const [previous, current] = Array.from(track?.children ?? [])
        if (!previous || !current || !shell) {
          throw new Error('Daily Plan swipe layout is incomplete')
        }
        return {
          dayGap: current.offsetLeft - previous.offsetLeft -
            previous.offsetWidth,
          pageEdgePadding: Number.parseFloat(
            getComputedStyle(shell).paddingLeft,
          ),
        }
      })()
    `)

    expect(spacing.dayGap).toBe(spacing.pageEdgePadding * 2)
  })

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

  test('real touch keeps Daily Plan horizontal after tracking starts', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium')
    const realTouch = await createRealTouchPage(browser)
    try {
      await realTouch.page.locator('.period-inspect-button').first()
        .waitFor()
      const surface = realTouch.page.locator('.daily-plan-swipe-frame')
      await watchPointerCancellation(realTouch.page)

      await realTouch.touch('touchStart', 300, 260)
      await realTouch.touch('touchMove', 286, 260)
      await expect(surface).toHaveAttribute('data-motion', 'dragging')

      await realTouch.touch('touchMove', 284, 280)
      await realTouch.page.waitForTimeout(50)
      await expect(surface).toHaveAttribute('data-motion', 'dragging')
      expect(await pointerCancellationCount(realTouch.page)).toBe(0)

      await realTouch.touch('touchEnd')
      await expect(surface).toHaveAttribute('data-motion', 'idle')

      const initialScrollY = await realTouch.page.evaluate<number>(
        'globalThis.scrollY',
      )
      await watchPointerCancellation(realTouch.page)
      await realTouch.touch('touchStart', 300, 520)
      await realTouch.touch('touchMove', 298, 450)
      await realTouch.page.waitForTimeout(50)
      await realTouch.touch('touchEnd')
      expect(await realTouch.page.evaluate<number>('globalThis.scrollY'))
        .toBeGreaterThan(initialScrollY)
      expect(await pointerCancellationCount(realTouch.page)).toBe(1)
    } finally {
      await realTouch.context.close()
    }
  })

  test('real touch favors a steep diagonal Daily Plan swipe', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium')
    const realTouch = await createRealTouchPage(browser)
    try {
      await realTouch.page.locator('.period-inspect-button').first()
        .waitFor()
      const surface = realTouch.page.locator('.daily-plan-swipe-frame')
      await watchPointerCancellation(realTouch.page)

      await realTouch.touch('touchStart', 300, 260)
      await realTouch.touch('touchMove', 290, 278)
      await realTouch.page.waitForTimeout(50)

      await expect(surface).toHaveAttribute('data-motion', 'dragging')
      expect(await pointerCancellationCount(realTouch.page)).toBe(0)

      await realTouch.touch('touchEnd')
      await expect(surface).toHaveAttribute('data-motion', 'idle')
    } finally {
      await realTouch.context.close()
    }
  })

  test('real touch keeps cancellation row horizontal after tracking starts', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium')
    const realTouch = await createRealTouchPage(browser)
    try {
      const suffix = Date.now()
      await realTouch.page.getByRole('button', {
        name: 'この日の予定を編集',
      }).click()
      await realTouch.page.getByRole('button', { name: 'タスクを追加' })
        .click()
      const taskDialog = realTouch.page.getByRole('dialog', {
        name: 'タスクを追加',
      })
      await taskDialog.getByRole('textbox', { name: 'タイトル' })
        .fill(`実タッチ-${suffix}`)
      await taskDialog.getByLabel('変更適用範囲').selectOption('class')
      await taskDialog.getByRole('button', { name: '下書きを保存' })
        .click()
      await realTouch.page.getByRole('button', {
        name: /変更を反映（1）/,
      }).click()

      const row = realTouch.page.getByRole('dialog', { name: '変更を反映' })
        .locator('.draft-cancellation-row').first()
      const box = await row.boundingBox()
      expect(box).not.toBeNull()
      const startX = box!.x + box!.width * 0.75
      const startY = box!.y + box!.height * 0.5
      await watchPointerCancellation(realTouch.page)

      await realTouch.touch('touchStart', startX, startY)
      await realTouch.touch('touchMove', startX - 14, startY)
      await expect(row).toHaveClass(/draft-cancellation-dragging/)

      await realTouch.touch('touchMove', startX - 16, startY + 20)
      await realTouch.page.waitForTimeout(50)
      await expect(row).toHaveClass(/draft-cancellation-dragging/)
      expect(await pointerCancellationCount(realTouch.page)).toBe(0)

      await realTouch.touch('touchEnd')
    } finally {
      await realTouch.context.close()
    }
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

async function createRealTouchPage(browser: Browser) {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    storageState: 'test-results/playwright/auth/chromium.json',
  })
  const page = await context.newPage()
  await page.goto('/')
  const session = await context.newCDPSession(page)

  return {
    context,
    page,
    touch(
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      x?: number,
      y?: number,
    ) {
      return session.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined || y === undefined
          ? []
          : [{
              x,
              y,
              id: 1,
              radiusX: 1,
              radiusY: 1,
              force: 1,
            }],
      })
    },
  }
}

async function watchPointerCancellation(page: Awaited<
  ReturnType<typeof createRealTouchPage>
>['page']) {
  await page.evaluate(`
    globalThis.__pointerCancellationCount = 0
    if (!globalThis.__pointerCancellationWatcherInstalled) {
      globalThis.__pointerCancellationWatcherInstalled = true
      document.addEventListener('pointercancel', () => {
        globalThis.__pointerCancellationCount += 1
      }, true)
    }
  `)
}

function pointerCancellationCount(page: Awaited<
  ReturnType<typeof createRealTouchPage>
>['page']) {
  return page.evaluate<number>(
    'globalThis.__pointerCancellationCount',
  )
}
