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
  await expect(firstPeriod.locator('.timetable-change-removal-draft'))
    .toHaveCSS('background-color', 'rgb(251, 232, 232)')
  await expect(firstPeriod.getByRole('img', {
    name: '時間割変更の削除予定',
  })).toBeVisible()
  await expect(firstPeriod.getByRole('button', {
    name: /時間割変更の削除予定。/,
  })).toBeVisible()
  const note = firstPeriod.locator('.daily-lesson-note-list .note-item')
    .filter({ hasText: noteBody })
  await expect(note).toBeVisible()
  await expect(note).not.toHaveClass(/note-removal-draft/)
  await expect(note).not.toHaveCSS('background-color', 'rgb(251, 232, 232)')
})

async function applyCurrentDraft(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '変更内容（1）' }).click()
  await page.getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: '反映を確認' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog', { name: '最終確認' })
    .getByRole('button', { name: '変更を反映' }).click()
  await expect(page.getByRole('button', { name: 'この日の予定を編集' }))
    .toBeVisible()
}
