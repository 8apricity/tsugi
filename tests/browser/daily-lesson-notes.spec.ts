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
    [
      `Note-only 1-${suffix}`,
      '2行目',
      '3行目',
      '4行目',
      '5行目',
    ].join('\n'),
    `Note-only 2-${suffix}`,
  ]
  const updatedBody = `更新-${noteOnlyBodies[0]}`

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: /^7限/ }).click()

  let layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await openLayerEditor(layerDialog, '文科')
  let timetableEditor = page.getByRole('dialog', { name: '時間割変更' })
  await expect(
    timetableEditor.getByRole('textbox', { name: /ノート本文/ }),
  ).toHaveCount(0)
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

  const dailyPlanPeriod = page.locator('.period-row').filter({
    hasText: noteOnlyBodies[0],
  })
  const dailyPlanNote = dailyPlanPeriod
    .locator('.daily-lesson-note-list .note-item')
    .filter({ hasText: noteOnlyBodies[0] })
  await expect(dailyPlanNote).toHaveClass(/note-related/)
  await expect(dailyPlanNote).toHaveAttribute('role', 'button')
  await page.mouse.move(0, 0)
  await expect(dailyPlanNote).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(dailyPlanNote).toHaveCSS('border-top-width', '0px')
  const scopeBadge = dailyPlanNote.getByText('3組', { exact: true })
  const noteBody = dailyPlanNote.locator('p')
  const scopeBox = await scopeBadge.boundingBox()
  const noteBodyBox = await noteBody.boundingBox()
  expect(scopeBox).not.toBeNull()
  expect(noteBodyBox).not.toBeNull()
  expect(scopeBox!.y).toBeLessThan(noteBodyBox!.y)

  const periodBox = await dailyPlanPeriod.boundingBox()
  const periodNumberBox = await dailyPlanPeriod.locator('.period-number')
    .boundingBox()
  expect(periodBox).not.toBeNull()
  expect(periodNumberBox).not.toBeNull()
  expect(Math.abs(periodBox!.height - periodNumberBox!.height))
    .toBeLessThanOrEqual(1)

  const expand = dailyPlanNote.getByRole('button', {
    name: 'ノートの続きを読む',
  })
  await expect(expand).toBeVisible()
  await expand.click()
  await expect(page.getByRole('dialog', { name: '時間割の変更状況' }))
    .toHaveCount(0)
  await expect(dailyPlanNote.locator('.note-body-expanded'))
    .toContainText(noteOnlyBodies[0])
  await dailyPlanNote.click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await expect(layerDialog).toBeVisible()
  await layerDialog.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: /^7限/ }).click()
  layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  const noteCard = noteButton(layerDialog, noteOnlyBodies[0])
  await expect(noteCard).toHaveCount(1)
  const layerPresentation = await noteCard.evaluate((note) => {
    const layer = note.closest('.layer-with-notes')
    const arrow = layer?.querySelector('.layer-flow-arrow')
    const style = arrow
      ? arrow.ownerDocument.defaultView?.getComputedStyle(arrow, '::before')
      : null
    return {
      notePrecedesArrow: !!arrow && !!(
        note.compareDocumentPosition(arrow) & 4
      ),
      backgroundColor: style?.backgroundColor,
      clipPath: style?.clipPath,
    }
  })
  expect(layerPresentation.notePrecedesArrow).toBe(true)
  expect(layerPresentation.backgroundColor).toBe('rgb(31, 41, 51)')
  expect(layerPresentation.clipPath).toContain('polygon')
  await expect(noteCard.getByText('3組', { exact: true })).toHaveCount(0)
  await expect(noteCard).toHaveCSS('background-color', 'rgb(248, 250, 251)')
  await expect(noteCard).toHaveCSS('border-top-width', '1px')
  await expect(noteCard).toContainText('›')
  await noteCard.click()

  let noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await expect(noteDetail).toContainText(noteOnlyBodies[0])
  await expect(
    noteDetail.getByRole('button', { name: '編集履歴' }),
  ).toBeVisible()
  await expect(
    noteDetail.getByRole('button', { name: '時間割の変更状況に戻る' }),
  ).toBeVisible()
  await noteDetail
    .getByRole('button', { name: '時間割の変更状況に戻る' })
    .click()
  await expect(layerDialog).toBeVisible()
  await expect(noteCard).toBeFocused()

  await noteCard.click()
  await noteDetail.getByRole('button', { name: '閉じる' }).click()
  await expect(noteDetail).toHaveCount(0)
  await expect(layerDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^7限/ })).toBeFocused()

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
  return dialog.getByRole('button').filter({
    hasText: body.split('\n')[0],
  })
}

async function fillNoteBodies(
  dialog: Locator,
  bodies: string[],
) {
  for (const [index, body] of bodies.entries()) {
    await dialog.getByRole('button', { name: '＋ノートを追加' }).click()
    await dialog.getByRole('textbox', { name: `ノート本文 ${index + 1}` })
      .fill(body)
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function applyCurrentDrafts(page: Page, count: number) {
  await page.getByRole('button', { name: `変更を反映（${count}）` }).click()
  await page
    .getByRole('dialog', { name: '変更を反映' })
    .getByRole('button', { name: '確定' })
    .click()
  await expect(
    page.getByRole('button', { name: 'この日の予定を編集' }),
  ).toBeVisible()
}
