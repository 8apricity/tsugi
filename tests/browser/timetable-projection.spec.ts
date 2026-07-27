import { expect, test } from '@playwright/test'

test('edit mode shows projected transitions, including identical and removal drafts', async ({
  page,
}, testInfo) => {
  const customLessonName = '地域横断型のとても長い探究プロジェクト演習'
  const noteBody = `removal-note-${testInfo.project.name}`
  await page.goto('/')
  const mondayIndex = testInfo.project.name === 'webkit-iphone' ? 1 : 0
  await page.locator('.date-cell').filter({
    has: page.getByText('月', { exact: true }),
  }).nth(mondayIndex).click()

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  const firstPeriod = page.locator('.period-row').filter({
    has: page.locator('.period-number', { hasText: '1' }),
  })
  await expect(firstPeriod.locator('.lesson-name')).toHaveText('数Ⅱβ（月1）')

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  const layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  const editor = page.getByRole('dialog', { name: '時間割変更' })
  const includeChange = editor.getByRole('checkbox', { name: '時間割も変更する' })
  if (!(await includeChange.isChecked())) await includeChange.check()
  await editor.getByRole('button', { name: '月3', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  const transition = firstPeriod.locator('.lesson-transition')
  await expect(transition).toHaveText('数Ⅱβ（月1）▶家庭（月3）')
  await expect(firstPeriod.locator('.period-inspect-button'))
    .toHaveCSS('background-color', 'rgb(217, 238, 240)')
  await expect(transition.locator('.lesson-transition-arrow'))
    .toHaveAttribute('aria-hidden', 'true')
  await expect(firstPeriod.getByRole('button', {
    name: /現在 数Ⅱβ、参照元 月1。変更後 家庭、参照元 月3。/,
  })).toBeVisible()

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  await editor.getByRole('button', { name: '月1', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await expect(transition).toHaveText('数Ⅱβ（月1）▶数Ⅱβ（月1）')

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  await editor.getByRole('combobox', { name: '授業名' }).fill(customLessonName)
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await expect(transition).toContainText(customLessonName)
  await expect(transition.locator('.lesson-reference')).toHaveCount(1)
  if (testInfo.project.name === 'webkit-iphone') {
    const beforeBox = await transition.locator('.lesson-transition-before')
      .boundingBox()
    const destinationBox = await transition
      .locator('.lesson-transition-destination').boundingBox()
    expect(beforeBox).not.toBeNull()
    expect(destinationBox).not.toBeNull()
    expect(destinationBox!.y).toBeGreaterThan(beforeBox!.y)
  }

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  await editor.getByRole('button', { name: '★', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await expect(transition).toHaveText('数Ⅱβ（月1）▶自走（★）')

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  await editor.getByRole('button', { name: '月3', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDraft(page)

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.getByRole('button', {
    name: /^3組の時間割を編集/,
  }).click()
  await editor.getByRole('checkbox', { name: '削除予定にする' }).check()
  await editor.getByRole('button', { name: '＋ノートを追加' }).click()
  await editor.getByRole('textbox', { name: 'ノート本文 1' }).fill(noteBody)
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await expect(transition).toHaveText('家庭（月3）▶数Ⅱβ（月1）')
  await expect(firstPeriod.locator('.period-inspect-button'))
    .toHaveCSS('background-color', 'rgb(253, 236, 236)')
  await expect(firstPeriod).not.toHaveCSS(
    'background-color',
    'rgb(217, 238, 240)',
  )
  await expect(firstPeriod.getByRole('img', { name: '削除予定' }))
    .toHaveCount(1)
  await expect(firstPeriod.getByRole('img', {
    name: '時間割変更の削除予定',
  })).toHaveCount(0)
  await expect(firstPeriod.getByRole('button', {
    name: /時間割変更の削除予定。/,
  })).toBeVisible()
  const note = firstPeriod.locator('.daily-lesson-note-list .note-item')
    .filter({ hasText: noteBody })
  await expect(note).toBeVisible()
  await expect(note).not.toHaveClass(/note-removal-draft/)
  await expect(note).toHaveCSS('background-color', 'rgb(232, 245, 246)')

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  const removalLayer = layerDialog.locator('.layer-row-shell').filter({
    hasText: '3組',
  })
  await expect(removalLayer).toHaveCSS(
    'background-color',
    'rgb(253, 236, 236)',
  )
  await expect(removalLayer.getByText('月3', { exact: true })).toBeVisible()
  await expect(removalLayer.getByText('削除予定', { exact: true }))
    .toHaveCount(0)
  await expect(removalLayer.getByRole('img', {
    name: '時間割変更の削除予定',
  })).toBeVisible()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: '変更を反映（2）' }).click()
  const review = page.getByRole('dialog', { name: '変更を反映' })
  const removalUnit = review.getByRole('article', {
    name: '時間割変更の削除予定',
  })
  await expect(removalUnit).toHaveCSS(
    'background-color',
    'rgb(253, 236, 236)',
  )
  await expect(removalUnit.getByRole('img', {
    name: '時間割変更の削除予定',
  })).toBeVisible()
  await expect(removalUnit.getByRole('button', {
    name: /月3/,
  })).toBeVisible()
  await expect(removalUnit).not.toContainText('削除予定')
  await expect(removalUnit).not.toContainText(noteBody)
  await expect(review.getByText(noteBody, { exact: true })).toBeVisible()
})

test('uses a neutral mixed color for replacement and removal layer drafts', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const mondayIndex = testInfo.project.name === 'webkit-iphone' ? 1 : 0
  await page.locator('.date-cell').filter({
    has: page.getByText('月', { exact: true }),
  }).nth(mondayIndex).click()
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const firstPeriod = page.locator('.period-row').filter({
    has: page.locator('.period-number', { hasText: '1' }),
  })
  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  const layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await layerDialog.locator(
    '[data-target-scope-type="class"] .timetable-layer-row',
  ).click()
  const editor = page.getByRole('dialog', { name: '時間割変更' })
  await editor.getByRole('checkbox', { name: '削除予定にする' }).check()
  await editor.getByRole('button', { name: '下書きを保存' }).click()

  await layerDialog.locator(
    '[data-target-scope-type="grade"] .timetable-layer-row',
  ).click()
  const includeChange = editor.getByRole('checkbox', {
    name: '時間割も変更する',
  })
  if (!(await includeChange.isChecked())) await includeChange.check()
  await editor.getByRole('button', { name: '月4', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await expect(firstPeriod.locator('.period-inspect-button'))
    .toHaveCSS('background-color', 'rgb(243, 238, 251)')
  await expect(firstPeriod.getByRole('img', { name: '削除予定' }))
    .toHaveCount(1)
  await expect(firstPeriod.getByRole('img', { name: /追加予定|更新予定/ }))
    .toHaveCount(1)
})

test('keeps removal visible when a Timetable Change draft conflicts', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const mondayIndex = testInfo.project.name === 'webkit-iphone' ? 1 : 0
  await page.locator('.date-cell').filter({
    has: page.getByText('月', { exact: true }),
  }).nth(mondayIndex).click()
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const firstPeriod = page.locator('.period-row').filter({
    has: page.locator('.period-number', { hasText: '1' }),
  })
  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  const layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await layerDialog.locator(
    '[data-target-scope-type="class"] .timetable-layer-row',
  ).click()
  const editor = page.getByRole('dialog', { name: '時間割変更' })
  const includeChange = editor.getByRole('checkbox', {
    name: '時間割も変更する',
  })
  if (!(await includeChange.isChecked())) await includeChange.check()
  await editor.getByRole('button', { name: '月4', exact: true }).click()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDraft(page)

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  await layerDialog.locator(
    '[data-target-scope-type="class"] .timetable-layer-row',
  ).click()
  await editor.getByRole('checkbox', { name: '削除予定にする' }).check()
  await editor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await page.route('**/api/shared-information/direct-changes', async (route) => {
    const payload = route.request().postDataJSON() as {
      changes: Array<{
        targetScopeType: string
        changeDate: string
        periodNumber: number
      }>
    }
    const [change] = payload.changes
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'idempotency-conflict',
        conflictingKeys: [{
          targetScopeType: change.targetScopeType,
          changeDate: change.changeDate,
          periodNumber: change.periodNumber,
        }],
        conflictingSourceIds: [],
      }),
    })
  })
  await page.getByRole('button', { name: '変更を反映（1）' }).click()
  await page.getByRole('dialog', { name: '変更を反映' })
    .getByRole('button', { name: '確定' }).click()
  await expect(page.getByText(
    '表示中の内容が更新されました。ほかの変更と重なっている下書きを確認してください。',
    { exact: true },
  )).toBeVisible()

  await expect(firstPeriod.locator('.period-inspect-button'))
    .toHaveCSS('background-color', 'rgb(255, 248, 230)')
  const removalConflict = firstPeriod.getByRole('img', {
    name: '削除予定・要確認',
  })
  await expect(removalConflict).toHaveCount(1)
  await expect(removalConflict.locator('[data-glyph="ごみ箱"]')).toBeVisible()
  await expect(removalConflict.locator('[data-glyph="警告"]')).toHaveCount(0)

  await firstPeriod.getByRole('button', { name: /^1限/ }).click()
  const removalLayer = layerDialog.locator(
    '.layer-row-shell[data-target-scope-type="class"]',
  )
  await expect(removalLayer).toHaveCSS(
    'background-color',
    'rgb(255, 248, 230)',
  )
  await expect(removalLayer.getByRole('img', {
    name: '時間割変更の削除予定',
  })).toBeVisible()
})

async function applyCurrentDraft(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '変更を反映（1）' }).click()
  await page.getByRole('dialog', { name: '変更を反映' })
    .getByRole('button', { name: '確定' }).click()
  await expect(page.getByRole('button', { name: 'この日の予定を編集' }))
    .toBeVisible()
}
