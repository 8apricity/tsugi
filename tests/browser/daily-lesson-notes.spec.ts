import { expect, test, type Locator, type Page } from '@playwright/test'

test('Daily Lesson Notes support multiple and Note-only creation plus detail update/removal', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const lessonName = `DLN準備-${suffix}`
  const removalNoteBodies = [
    `変更削除時ノート1-${suffix}`,
    `変更削除時ノート2-${suffix}`,
  ]
  const noteOnlyBodies = [
    `Note-only 1-${suffix}`,
    `Note-only 2-${suffix}`,
  ]
  const updatedBody = `${noteOnlyBodies[0]}-更新`

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: /^7限/ }).click()

  let layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await openLayerEditor(layerDialog, '文科')
  let timetableEditor = page.getByRole('dialog', { name: '時間割変更' })
  const includeTimetableChange = timetableEditor.getByRole('checkbox', {
    name: '時間割も変更する',
  })
  if (!(await includeTimetableChange.isChecked())) {
    await includeTimetableChange.check()
  }
  await timetableEditor.getByRole('combobox', { name: '授業名' })
    .fill(lessonName)
  await expect(
    timetableEditor.getByRole('button', { name: '下書きを保存' }),
  ).toBeEnabled()
  await timetableEditor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDrafts(page, 1)

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await openLayerEditor(layerDialog, '文科')
  timetableEditor = page.getByRole('dialog', { name: '時間割変更' })

  await expect(
    timetableEditor.getByText('変更対象日', { exact: true }),
  ).toBeVisible()
  await expect(
    timetableEditor.getByText('時限', { exact: true }),
  ).toBeVisible()
  await expect(
    timetableEditor.getByText('変更適用範囲', { exact: true }),
  ).toBeVisible()
  await expect(
    timetableEditor.getByRole('textbox', { name: '変更対象日' }),
  ).toHaveCount(0)
  await expect(
    timetableEditor.getByRole('combobox', { name: '変更適用範囲' }),
  ).toHaveCount(0)

  const removalCheckbox = timetableEditor.getByRole('checkbox', {
    name: '削除予定にする',
  })
  await removalCheckbox.check()
  await expect(
    timetableEditor.getByRole('combobox', { name: '授業名' }),
  ).toBeDisabled()
  await fillNoteBodies(timetableEditor, [
    removalNoteBodies[0],
    '   ',
    removalNoteBodies[1],
  ])
  await expect(
    timetableEditor.getByRole('textbox', { name: 'ノート本文 1' }),
  ).toBeEnabled()
  await expect(
    timetableEditor.getByRole('button', { name: '＋ノートを追加' }),
  ).toBeEnabled()
  await timetableEditor.getByRole('button', { name: '下書きを保存' }).click()

  await openLayerEditor(layerDialog, '3組')
  timetableEditor = page.getByRole('dialog', { name: '時間割変更' })
  await expect(
    timetableEditor.getByRole('checkbox', { name: '時間割も変更する' }),
  ).not.toBeChecked()
  await fillNoteBodies(timetableEditor, [
    noteOnlyBodies[0],
    ' ',
    noteOnlyBodies[1],
  ])
  await timetableEditor.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDrafts(page, 5)

  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  const noteCard = noteButton(layerDialog, noteOnlyBodies[0])
  await expect(noteCard).toHaveCount(1)
  await expect(noteCard).toHaveCSS('background-color', 'rgb(248, 250, 251)')
  await expect(noteCard).toHaveCSS('border-top-width', '1px')
  await expect(noteCard).toContainText('›')
  await noteCard.click()

  let noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await expect(noteDetail).toContainText(noteOnlyBodies[0])
  await expect(
    noteDetail.getByRole('button', { name: '編集履歴' }),
  ).toBeVisible()
  await noteDetail.getByRole('button', { name: '閉じる' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await noteButton(layerDialog, noteOnlyBodies[0]).click()
  noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await noteDetail.getByRole('textbox', { name: '本文' }).fill(updatedBody)
  await noteDetail.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDrafts(page, 1)

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  const updatedCard = noteButton(layerDialog, updatedBody)
  await expect(updatedCard).toHaveCount(1)
  await updatedCard.click()
  noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await noteDetail.getByRole('checkbox', { name: '削除予定にする' }).check()
  await noteDetail.getByRole('button', { name: '下書きを保存' }).click()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()
  await applyCurrentDrafts(page, 1)

  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await expect(noteButton(layerDialog, updatedBody)).toHaveCount(0)
})

async function openLayerEditor(layerDialog: Locator, scopeLabel: string) {
  await layerDialog.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(scopeLabel)}の時間割を編集`),
  }).click()
}

function noteButton(dialog: Locator, body: string) {
  return dialog.getByRole('button', {
    name: new RegExp(escapeRegExp(body)),
  })
}

async function fillNoteBodies(
  dialog: Locator,
  bodies: string[],
) {
  for (const [index, body] of bodies.entries()) {
    if (index > 0) {
      await dialog.getByRole('button', { name: '＋ノートを追加' }).click()
    }
    await dialog.getByRole('textbox', { name: `ノート本文 ${index + 1}` })
      .fill(body)
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
