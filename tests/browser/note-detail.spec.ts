import { expect, test } from '@playwright/test'

test.describe('authenticated Daily Plan Note detail', () => {
  test('views and directly edits one reflected Note through the common detail flow', async ({
    page,
    browserName,
  }) => {
    const originalBody = `Note詳細テスト-${browserName}`
    const changedBody = `${originalBody}-変更後`

    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await page.getByRole('button', { name: 'ノートを追加' }).click()

    const addition = page.getByRole('dialog', { name: 'ノートを追加' })
    await addition.getByRole('textbox', { name: '本文' }).fill(originalBody)
    await addition
      .getByRole('combobox', { name: '変更適用範囲' })
      .selectOption('class')
    await addition.getByRole('button', { name: '下書きを保存' }).click()

    await page.getByRole('button', { name: /変更内容（1）/ }).click()
    await page
      .getByRole('dialog', { name: '変更内容' })
      .getByRole('button', { name: '反映を確認' })
      .click()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('dialog', { name: '最終確認' })
      .getByRole('button', { name: '変更を反映' })
      .click()

    const noteCard = page.locator('.note-item').filter({ hasText: originalBody })
    await expect(noteCard).toHaveAttribute('role', 'button')
    await expect(noteCard.locator('.note-detail-chevron')).toHaveText('›')
    await noteCard.click()

    const readOnlyDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
    await expect(readOnlyDetail).toContainText(originalBody)
    await expect(readOnlyDetail).toContainText('変更適用範囲')
    await expect(readOnlyDetail).toContainText('3組')
    await expect(readOnlyDetail.locator('textarea')).toHaveCount(0)
    await expect(
      readOnlyDetail.getByRole('button', { name: '閉じる' }),
    ).toBeVisible()
    await expect(
      readOnlyDetail.getByRole('button', { name: '戻る' }),
    ).toHaveCount(0)
    await expect(
      readOnlyDetail.getByRole('checkbox', { name: '削除予定にする' }),
    ).toHaveCount(0)

    await readOnlyDetail.getByRole('button', { name: '編集履歴' }).click()
    const history = page.getByRole('dialog', { name: 'ノートの編集履歴' })
    await expect(history).toBeVisible()
    await history
      .getByRole('button', { name: 'ノートの詳細に戻る' })
      .click()
    await expect(readOnlyDetail).toBeVisible()
    await readOnlyDetail.getByRole('button', { name: '閉じる' }).click()

    await noteCard.click()
    await readOnlyDetail.getByRole('button', { name: '編集履歴' }).click()
    await expect(
      history.getByRole('button', { name: 'ノートの詳細に戻る' }),
    ).toBeVisible()
    await expect(
      history.getByRole('button', { name: '閉じる' }),
    ).toBeVisible()
    await history.getByRole('button', { name: '閉じる' }).click()
    await expect(history).toHaveCount(0)
    await expect(readOnlyDetail).toHaveCount(0)

    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await noteCard.click()

    const editor = page.getByRole('dialog', { name: 'ノートの詳細' })
    const body = editor.getByRole('textbox', { name: '本文' })
    const removal = editor.getByRole('checkbox', { name: '削除予定にする' })
    await expect(editor.getByRole('button', { name: '戻る' })).toBeVisible()
    await expect(editor.getByRole('button', { name: '閉じる' })).toHaveCount(0)
    await expect(body).toHaveValue(originalBody)
    await expect(removal).not.toBeChecked()
    await expect(editor.locator('select:disabled, input[type="date"]:disabled'))
      .toHaveCount(0)

    await body.fill(changedBody)
    await editor.getByRole('button', { name: '戻る' }).click()
    const discard = page.getByRole('alertdialog', {
      name: '入力内容を破棄しますか？',
    })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: '編集を続ける' }).click()

    await removal.check()
    await expect(body).toBeDisabled()
    await expect(editor.getByRole('button', { name: '戻る' })).toBeEnabled()
    await expect(editor.getByRole('button', { name: '編集履歴' })).toBeEnabled()
    await expect(
      editor.getByRole('button', { name: '下書きを保存' }),
    ).toBeEnabled()

    await editor.getByRole('button', { name: '編集履歴' }).click()
    await history
      .getByRole('button', { name: 'ノートの詳細に戻る' })
      .click()
    await expect(removal).toBeChecked()
    await editor.getByRole('button', { name: '下書きを保存' }).click()

    const removalCard = page.getByRole('button').filter({
      hasText: originalBody,
    })
    await expect(removalCard).toBeVisible()
    await expect(
      removalCard.getByRole('img', { name: '削除予定のノート' }),
    ).toBeVisible()
    await expect(removalCard).toHaveCSS(
      'background-color',
      'rgb(253, 236, 236)',
    )
    await expect(removalCard.getByText('削除予定', { exact: true }))
      .toHaveCount(0)
    await applyCurrentDrafts(page)
  })

  test('returns a related Note to its retained Task detail', async ({
    page,
    browserName,
  }) => {
    const taskTitle = `Note親復帰-${browserName}`
    const noteBody = `Task関連Note-${browserName}`

    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await page.getByRole('button', { name: 'タスクを追加' }).click()
    const taskAddition = page.getByRole('dialog', { name: 'タスクを追加' })
    await taskAddition.getByRole('textbox', { name: 'タイトル' }).fill(taskTitle)
    await taskAddition
      .getByRole('combobox', { name: '変更適用範囲' })
      .selectOption('class')
    await taskAddition.getByRole('button', { name: '下書きを保存' }).click()
    await applyCurrentDrafts(page)

    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const taskCard = page.locator('.task-entry').filter({ hasText: taskTitle })
    await taskCard.locator('.task-item').click()
    const taskDetail = page.getByRole('dialog', { name: 'タスクの詳細' })
    await taskDetail.getByRole('button', { name: 'ノートを書く' }).click()

    const noteAddition = page.getByRole('dialog', { name: 'ノートを書く' })
    await noteAddition.getByRole('textbox', { name: '本文' }).fill(noteBody)
    await noteAddition.getByRole('button', { name: '下書きを保存' }).click()
    await expect(taskDetail).toBeVisible()
    await taskDetail.getByRole('button', { name: '閉じる' }).click()
    await applyCurrentDrafts(page)

    await taskCard.locator('.task-item').click()
    await expect(taskDetail).toBeVisible()
    const relatedNote = taskDetail.locator('.note-item').filter({
      hasText: noteBody,
    })
    await expect(relatedNote).toHaveAttribute('role', 'button')
    await expect(relatedNote.locator('.note-detail-chevron')).toHaveCount(0)
    await relatedNote.click()

    const noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
    await expect(noteDetail).toContainText(`タスク「${taskTitle}」`)
    await expect(taskDetail).toHaveCount(0)
    await noteDetail.getByRole('button', { name: '閉じる' }).click()
    await expect(noteDetail).toHaveCount(0)
    await expect(taskDetail).toBeVisible()

    await taskDetail.getByRole('button', { name: '閉じる' }).click()
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await taskCard.locator('.task-item').click()
    const editableRelatedNote = taskDetail.locator('.note-item').filter({
      hasText: noteBody,
    })
    await editableRelatedNote.click()
    const relatedNoteEditor = page.getByRole('dialog', { name: 'ノートの詳細' })
    const updatedNoteBody = `${noteBody}-更新下書き`
    await relatedNoteEditor
      .getByRole('textbox', { name: '本文' })
      .fill(updatedNoteBody)
    await relatedNoteEditor
      .getByRole('button', { name: '下書きを保存' })
      .click()
    await expect(taskDetail).toBeVisible()

    const relatedUpdateDraft = taskDetail.locator('.note-item').filter({
      hasText: updatedNoteBody,
    })
    await relatedUpdateDraft.click()
    await expect(
      relatedNoteEditor.getByRole('textbox', { name: '本文' }),
    ).toHaveValue(updatedNoteBody)
    await relatedNoteEditor.getByRole('button', { name: '戻る' }).click()
    await expect(taskDetail).toBeVisible()

    await taskDetail.getByRole('button', { name: '削除予定にする' }).click()
    await page
      .getByRole('dialog', { name: 'タスクを削除予定にしますか？' })
      .getByRole('button', { name: '削除予定にする' })
      .click()
    await applyCurrentDrafts(page)
  })
})

async function applyCurrentDrafts(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /変更内容（1）/ }).click()
  await page
    .getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: '反映を確認' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('dialog', { name: '最終確認' })
    .getByRole('button', { name: '変更を反映' })
    .click()
}
