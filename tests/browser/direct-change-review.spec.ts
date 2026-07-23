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
    await saveTaskWithNotes(page, `review-conflict-${Date.now()}`, 0)

    await page.getByRole('button', { name: '変更を反映（1）' }).click()
    await page.getByRole('dialog', { name: '変更を反映' })
      .getByRole('button', { name: '確定' })
      .click()

    await page.getByRole('button', { name: '変更を反映（1）' }).click()
    const review = page.getByRole('dialog', { name: '変更を反映' })
    await expect(review.getByRole('button', { name: '確定' })).toBeDisabled()
    await expect(review.getByRole('alert')).toContainText(
      'ほかの変更と重なっている下書きがあります。',
    )
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
