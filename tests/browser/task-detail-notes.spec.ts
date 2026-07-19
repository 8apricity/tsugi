import { expect, test, type Page } from '@playwright/test'

test('Task add/edit saves zero, one, and multiple related Notes from Task detail', async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const zeroTitle = `NoteなしTask-${suffix}`
  const oneTitle = `Note1件Task-${suffix}`
  const multipleTitle = `Note複数Task-${suffix}`

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  await addTask(page, zeroTitle, [])
  await addTask(page, oneTitle, ['1件目の関連ノート'])
  await addTask(page, multipleTitle, [
    '複数ノートの1件目',
    '   ',
    '複数ノートの2件目',
  ])

  await applyCurrentDrafts(page, 6)

  const multipleTask = page.locator('.task-entry').filter({
    hasText: multipleTitle,
  }).last()
  await multipleTask.locator('.task-item').click()

  const detail = page.getByRole('dialog', { name: 'タスクの詳細' })
  const relatedNotes = detail.getByRole('button').filter({
    hasText: /複数ノートの[12]件目/,
  })
  await expect(relatedNotes).toHaveCount(2)
  await expect(relatedNotes.first().getByText('3組', { exact: true }))
    .toHaveCount(0)
  await expect(relatedNotes.first()).toContainText('›')
  await expect(relatedNotes.first()).toHaveCSS(
    'background-color',
    'rgb(248, 250, 251)',
  )
  await expect(relatedNotes.first()).toHaveCSS('border-top-width', '1px')

  await relatedNotes.first().click()
  const noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await expect(noteDetail).toContainText(/複数ノートの[12]件目/)
  await noteDetail.getByRole('button', { name: '閉じる' }).click()
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await multipleTask.locator('.task-item').click()

  const editor = page.getByRole('dialog', { name: 'タスクを編集' })
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' })).toHaveCount(0)
  await expect(editor.getByRole('textbox', { name: 'タイトル' }))
    .toHaveValue(multipleTitle)
  await expect(
    editor.getByRole('combobox', { name: '変更適用範囲' }),
  ).toHaveCount(0)
  await expect(editor.getByText('3組', { exact: true })).toBeVisible()
  await expect(editor.getByRole('button').filter({
    hasText: /複数ノートの[12]件目/,
  })).toHaveCount(2)

  const updatedTitle = `${multipleTitle}-更新`
  await editor.getByRole('textbox', { name: 'タイトル' }).fill(updatedTitle)
  for (const body of ['編集時の追加ノート', '  ']) {
    await editor.getByRole('button', { name: '＋ノートを追加' }).click()
    const fields = editor.getByRole('textbox', { name: /ノート本文/ })
    await fields.nth((await fields.count()) - 1).fill(body)
  }
  await editor.getByRole('button', { name: '下書きを保存' }).click()

  await applyCurrentDrafts(page, 2)
  const updatedTask = page.locator('.task-entry').filter({
    hasText: updatedTitle,
  }).last()
  await updatedTask.locator('.task-item').click()
  const updatedDetail = page.getByRole('dialog', { name: 'タスクの詳細' })
  await expect(updatedDetail).toContainText('編集時の追加ノート')
})

async function addTask(page: Page, title: string, noteBodies: string[]) {
  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const dialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await dialog.getByRole('textbox', { name: 'タイトル' }).fill(title)
  await dialog
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('class')
  for (const body of noteBodies) {
    await dialog.getByRole('button', { name: '＋ノートを追加' }).click()
    const fields = dialog.getByRole('textbox', { name: /ノート本文/ })
    await fields.nth((await fields.count()) - 1).fill(body)
  }
  await dialog.getByRole('button', { name: '下書きを保存' }).click()
}

async function applyCurrentDrafts(page: Page, count: number) {
  await page.getByRole('button', { name: `変更内容（${count}）` }).click()
  await page
    .getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: '反映を確認' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('dialog', { name: '最終確認' })
    .getByRole('button', { name: '変更を反映' })
    .click()
  await expect(
    page.getByRole('button', { name: 'この日の予定を編集' }),
  ).toBeVisible()
}
