import { expect, test, type Page } from '@playwright/test'

test.setTimeout(60_000)

test('Task add/edit saves zero, one, and multiple related Notes from Task detail', async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const zeroTitle = `NoteなしTask-${suffix}`
  const oneTitle = `Note1件Task-${suffix}`
  const multipleTitle = `Note複数Task-${suffix}`
  const firstMultipleNote = [
    `複数ノートの1件目-${suffix}`,
    '2行目',
    '3行目',
    '4行目',
    '5行目',
  ].join('\n')

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  await addTask(page, zeroTitle, [])
  await addTask(page, oneTitle, ['1件目の関連ノート'])
  await addTask(page, multipleTitle, [
    firstMultipleNote,
    '   ',
    '複数ノートの2件目',
  ])

  await applyCurrentDrafts(page, 6)

  await expectTaskNotes(page, zeroTitle, [])
  await expectTaskNotes(page, oneTitle, ['1件目の関連ノート'])

  const multipleTask = page.locator('.task-entry').filter({
    hasText: multipleTitle,
  }).last()
  const dailyPlanRelatedNote = multipleTask
    .locator('.task-note-list .note-item')
    .filter({ hasText: firstMultipleNote })
  await expect(dailyPlanRelatedNote).toHaveClass(/note-related/)
  await expect(dailyPlanRelatedNote).toHaveAttribute('role', 'button')
  await page.mouse.move(0, 0)
  await expect(dailyPlanRelatedNote).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(dailyPlanRelatedNote).toHaveCSS('border-top-width', '0px')
  await expect(multipleTask).toHaveCSS('border-top-width', '1px')

  const expand = dailyPlanRelatedNote.getByRole('button', {
    name: 'ノートの続きを読む',
  })
  await expect(expand).toBeVisible()
  await expand.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' }))
    .toHaveCount(0)
  await expect(dailyPlanRelatedNote.locator('.note-body-expanded'))
    .toContainText(firstMultipleNote)
  await expect(expand).toHaveCount(0)

  await dailyPlanRelatedNote.click()
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' })).toBeVisible()

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
  const detailBodyBox = await detail.locator('.editor-dialog-body').boundingBox()
  const firstNoteBox = await relatedNotes.first().boundingBox()
  expect(detailBodyBox).not.toBeNull()
  expect(firstNoteBox).not.toBeNull()
  expect(firstNoteBox!.x - detailBodyBox!.x).toBeGreaterThanOrEqual(21)
  expect(firstNoteBox!.x - detailBodyBox!.x).toBeLessThanOrEqual(23)
  expect(
    detailBodyBox!.x + detailBodyBox!.width -
      (firstNoteBox!.x + firstNoteBox!.width),
  ).toBeGreaterThanOrEqual(21)
  expect(
    detailBodyBox!.x + detailBodyBox!.width -
      (firstNoteBox!.x + firstNoteBox!.width),
  ).toBeLessThanOrEqual(23)

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

  await editor.getByRole('button', { name: '戻る' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' })).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveClass(/page-scroll-locked/)

  await multipleTask.locator('.task-item').click()
  await expect(editor).toBeVisible()

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
  await updatedDetail.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const zeroTask = page.getByRole('article').filter({
    has: page.getByRole('button', { name: new RegExp(zeroTitle) }),
  })
  await zeroTask.getByRole('button', { name: new RegExp(zeroTitle) }).click()
  const zeroRemovalEditor = page.getByRole('dialog', { name: 'タスクを編集' })
  await zeroRemovalEditor
    .getByRole('checkbox', { name: '削除予定にする' })
    .check()
  await zeroRemovalEditor.getByRole('button', { name: '下書きを保存' }).click()
  await expect(page.getByRole('dialog', {
    name: 'タスクを削除予定にしますか？',
  })).toHaveCount(0)
  const zeroRemovalDraft = page.getByRole('article', {
    name: '削除予定のタスク',
    exact: true,
  })
  await expect(zeroRemovalDraft.getByRole('img', {
    name: '削除予定のタスク',
    exact: true,
  })).toHaveCount(1)
  await expect(zeroRemovalDraft)
    .not.toContainText('このタスクだけが削除予定になります。')
  await zeroRemovalDraft.getByRole('button', { name: new RegExp(zeroTitle) })
    .click()
  const savedZeroRemovalEditor = page.getByRole('dialog', {
    name: 'タスクを編集',
  })
  await savedZeroRemovalEditor
    .getByRole('checkbox', { name: '削除予定にする' })
    .uncheck()
  await savedZeroRemovalEditor
    .getByRole('button', { name: '下書きを保存' })
    .click()

  await updatedTask.locator('.task-item').click()
  const removalEditor = page.getByRole('dialog', { name: 'タスクを編集' })
  const removalCheckbox = removalEditor.getByRole('checkbox', {
    name: '削除予定にする',
  })
  await expect(removalCheckbox).toBeVisible()
  const unsavedTitle = `${updatedTitle}-未保存`
  await removalEditor.getByRole('textbox', { name: 'タイトル' })
    .fill(unsavedTitle)
  await removalEditor.getByRole('button', { name: '＋ノートを追加' }).click()
  await removalEditor.getByRole('textbox', { name: /ノート本文/ })
    .last()
    .fill('確認取消で保持する未保存ノート')
  await removalCheckbox.check()
  await expect(removalEditor.getByRole('textbox', { name: 'タイトル' }))
    .toBeDisabled()
  await expect(removalEditor.getByRole('button', { name: '＋ノートを追加' }))
    .toBeDisabled()
  await removalEditor.getByRole('button', { name: '下書きを保存' }).click()

  const removalConfirmation = page.getByRole('dialog', {
    name: 'タスクを削除予定にしますか？',
  })
  await expect(removalConfirmation).toContainText(updatedTitle)
  await expect(removalConfirmation).not.toContainText(unsavedTitle)
  await expect(removalConfirmation)
    .toContainText('関連するノート3件も削除予定になります。')
  await expect(removalConfirmation).toContainText(firstMultipleNote.split('\n')[0])
  await expect(removalConfirmation).toContainText('複数ノートの2件目')
  await expect(removalConfirmation).toContainText('編集時の追加ノート')
  const cancelRemoval = removalConfirmation.getByRole('button', {
    name: 'キャンセル',
  })
  await expect(cancelRemoval).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(removalEditor).toBeVisible()
  await expect(removalCheckbox).toBeChecked()
  await expect(removalCheckbox).toBeFocused()
  await expect(removalEditor.getByRole('textbox', { name: 'タイトル' }))
    .toHaveValue(unsavedTitle)
  await expect(removalEditor.getByRole('textbox', { name: /ノート本文/ }).last())
    .toHaveValue('確認取消で保持する未保存ノート')

  await removalEditor.getByRole('button', { name: '下書きを保存' }).click()
  await expect(removalConfirmation).toBeVisible()
  await page.goBack()
  await expect(removalEditor).toBeVisible()
  await expect(removalCheckbox).toBeChecked()
  await expect(removalEditor.getByRole('textbox', { name: 'タイトル' }))
    .toHaveValue(unsavedTitle)

  await removalEditor.getByRole('button', { name: '下書きを保存' }).click()
  await removalConfirmation.getByRole('button', { name: '削除予定にする' })
    .click()

  const removalDraftTask = page.getByRole('article', {
    name: '削除予定のタスク。関連するノート3件も削除予定です',
  })
  const removalTaskButton = removalDraftTask.getByRole('button', {
    name: new RegExp(updatedTitle),
  })
  await expect(removalTaskButton).toBeFocused()
  await expect(removalDraftTask.getByRole('img', {
    name: '削除予定のタスク。関連するノート3件も削除予定です',
  })).toHaveCount(1)
  await expect(removalDraftTask.getByRole('button', {
    name: /複数ノートの[12]件目|編集時の追加ノート/,
  })).toHaveCount(0)
  await expect(removalDraftTask).toContainText('複数ノートの1件目')
  await expect(removalDraftTask).toContainText('複数ノートの2件目')
  await expect(removalDraftTask).toContainText('編集時の追加ノート')
  await expect(removalDraftTask).not.toContainText('タスクに伴い削除予定')
  await expect(removalDraftTask).not.toContainText('削除予定')

  await page.getByRole('button', { name: '変更内容（1）' }).click()
  await page
    .getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: new RegExp(updatedTitle) })
    .click()
  const reflectedRemovalEditor = page.getByRole('dialog', {
    name: 'タスクを編集',
  })
  const reflectedRemovalCheckbox = reflectedRemovalEditor.getByRole(
    'checkbox',
    { name: '削除予定にする' },
  )
  await expect(reflectedRemovalCheckbox).toBeChecked()
  await reflectedRemovalCheckbox.uncheck()
  await expect(
    reflectedRemovalEditor.getByRole('textbox', { name: 'タイトル' }),
  ).toBeEnabled()
  await reflectedRemovalEditor
    .getByRole('button', { name: '下書きを保存' })
    .click()
  const emptyChangeContent = page.getByRole('dialog', { name: '変更内容' })
  await expect(emptyChangeContent).toContainText('変更内容はありません。')
  await emptyChangeContent
    .getByRole('button', { name: '変更内容を閉じる' })
    .click()
  await expect(page.getByRole('button', { name: '変更内容（0）' })).toBeVisible()

  await updatedTask.locator('.task-item').click()
  const updateBeforeRemoval = page.getByRole('dialog', { name: 'タスクを編集' })
  const updateDraftTitle = `${updatedTitle}-下書き`
  await updateBeforeRemoval.getByRole('textbox', { name: 'タイトル' })
    .fill(updateDraftTitle)
  await updateBeforeRemoval.getByRole('button', { name: '下書きを保存' })
    .click()
  await page.getByRole('button', { name: '変更内容（1）' }).click()
  await page.getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: new RegExp(updateDraftTitle) })
    .click()
  const changeContentTaskEditor = page.getByRole('dialog', {
    name: 'タスクを編集',
  })
  await changeContentTaskEditor
    .getByRole('checkbox', { name: '削除予定にする' })
    .check()
  await changeContentTaskEditor
    .getByRole('button', { name: '下書きを保存' })
    .click()
  const changeContentRemovalConfirmation = page.getByRole('dialog', {
    name: 'タスクを削除予定にしますか？',
  })
  await expect(changeContentRemovalConfirmation).toContainText(updatedTitle)
  await expect(changeContentRemovalConfirmation).not.toContainText(updateDraftTitle)
  await changeContentRemovalConfirmation
    .getByRole('button', { name: '削除予定にする' })
    .click()
  await expect(page.getByRole('dialog', { name: '変更内容' })).toHaveCount(0)

  const finalRemovalDraftTask = page.getByRole('article', {
    name: '削除予定のタスク。関連するノート3件も削除予定です',
  })
  const finalRemovalTaskButton = finalRemovalDraftTask.getByRole('button', {
    name: new RegExp(updatedTitle),
  })
  await expect(finalRemovalTaskButton).toBeFocused()
  await finalRemovalTaskButton.click()
  const directRemovalEditor = page.getByRole('dialog', {
    name: 'タスクを編集',
  })
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' }))
    .toHaveCount(0)
  await expect(
    directRemovalEditor.getByRole('checkbox', { name: '削除予定にする' }),
  ).toBeChecked()
  await directRemovalEditor.getByRole('button', { name: '戻る' }).click()

  await applyCurrentDrafts(page, 1)
  await expect(updatedTask).toHaveCount(0)
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

async function expectTaskNotes(
  page: Page,
  title: string,
  expectedBodies: string[],
) {
  await page.locator('.task-entry').filter({ hasText: title }).last()
    .locator('.task-item').click()
  const detail = page.getByRole('dialog', { name: 'タスクの詳細' })
  const noteCards = detail.locator('.task-note-detail-list .note-item')
  await expect(noteCards).toHaveCount(expectedBodies.length)
  for (const [index, body] of expectedBodies.entries()) {
    await expect(noteCards.nth(index)).toContainText(body)
  }
  await detail.getByRole('button', { name: '閉じる' }).click()
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
