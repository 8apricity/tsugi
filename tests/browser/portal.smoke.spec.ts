import { expect, test } from '@playwright/test'

function expectBoxWithinViewport(
  box: { x: number; width: number },
  viewportWidth: number,
) {
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1)
}

test.describe('desktop browser entry', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Desktop browser entry journey',
  )

  test('an unauthenticated Student sees School Email login', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: '学校のメールでログイン' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '認証コードを送信' }),
    ).toBeVisible()

    await context.close()
  })
})

test('a fixed test Student reaches authenticated Daily Plan', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'メニュー' })).toBeVisible()
  await expect(page.getByRole('region', { name: '時間割' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '学校のメールでログイン' }),
  ).toHaveCount(0)
})

test('independent Note uses one detail flow for viewing, editing, removal, and history', async ({
  page,
}) => {
  const body = `Issue 59 Note ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: 'ノートを追加' }).click()

  const addDialog = page.getByRole('dialog', { name: 'ノートを追加' })
  await addDialog.getByRole('textbox', { name: '本文' }).fill(body)
  await addDialog
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('track')
  await addDialog.getByRole('button', { name: '下書きを保存' }).click()

  await page.getByRole('button', { name: '変更内容（1）' }).click()
  await page.getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: '反映を確認' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '変更を反映' }).click()
  await expect(page.getByRole('article').filter({ hasText: body })).toHaveCount(1)

  const noteCard = page.getByRole('article').filter({ hasText: body })
  await noteCard.getByRole('button', { name: 'ノートの詳細を開く' }).click()

  const detail = page.getByRole('dialog', { name: 'ノートの詳細' })
  await expect(detail.getByText(body, { exact: true })).toBeVisible()
  await expect(detail.getByRole('textbox', { name: '本文' })).toHaveCount(0)
  await detail.getByRole('button', { name: '編集履歴' }).click()

  const history = page.getByRole('dialog', { name: 'ノートの編集履歴' })
  await expect(history).toBeVisible()
  await history.getByRole('button', { name: 'ノートの詳細に戻る' }).click()
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: '閉じる' }).click()

  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await noteCard.getByRole('button', { name: 'ノートの詳細を開く' }).click()
  const editDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  const bodyEditor = editDetail.getByRole('textbox', { name: '本文' })
  await expect(bodyEditor).toBeVisible()
  const editedBody = `${body}・直接編集`
  await bodyEditor.fill(editedBody)
  await expect(bodyEditor).toHaveValue(editedBody)
  await editDetail.getByRole('button', { name: '下書きを更新' }).click()

  const updatedCard = page.getByRole('article').filter({ hasText: editedBody })
  await expect(updatedCard).toHaveCount(1)
  await updatedCard
    .getByRole('button', { name: 'ノートの詳細を開く' })
    .click()
  const removalDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
  const removalBodyEditor = removalDetail.getByRole('textbox', { name: '本文' })
  const removalCheckbox = removalDetail.getByRole('checkbox', {
    name: '削除予定にする',
  })
  await removalCheckbox.check()
  await expect(removalBodyEditor).toBeDisabled()

  await removalDetail.getByRole('button', { name: '戻る' }).click()
  const discardDialog = page.getByRole('alertdialog', {
    name: '入力内容を破棄しますか？',
  })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: '編集を続ける' }).click()
  await expect(removalBodyEditor).toBeDisabled()
  await removalDetail.getByRole('button', { name: '下書きを更新' }).click()

  const removalCard = page.getByRole('article').filter({ hasText: body })
  await expect(removalCard.getByRole('img', { name: '削除対象のノート' })).toBeVisible()
  await expect(removalCard.getByText('削除予定', { exact: true })).toHaveCount(0)
})

test('draft lifecycle protects Task input and explains immutable scope', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'Chromium desktop draft-lifecycle journey',
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: 'タスクを追加' }).click()

  const addDialog = page.getByRole('dialog', { name: 'タスクを追加' })
  const savedTitle = '下書き保護テスト'
  await expect(addDialog.getByRole('button', { name: '戻る' })).toBeVisible()
  await expect(addDialog.getByRole('button', { name: '閉じる' })).toHaveCount(0)
  await expect(
    addDialog.getByRole('button', { name: '下書きを保存' }),
  ).toBeVisible()
  await addDialog.getByRole('textbox', { name: 'タイトル' }).fill(savedTitle)
  await addDialog.getByRole('button', { name: '戻る' }).click()

  const discardDialog = page.getByRole('alertdialog', {
    name: '入力内容を破棄しますか？',
  })
  await expect(discardDialog).toBeVisible()
  await expect(discardDialog).toContainText('保存済みの下書きは変更されません。')
  await discardDialog.getByRole('button', { name: '編集を続ける' }).click()

  await addDialog
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('class')
  await addDialog.getByRole('button', { name: '下書きを保存' }).click()

  const draftCard = page.locator('.task-entry.task-draft').filter({
    hasText: savedTitle,
  })
  await expect(draftCard.getByRole('img', { name: '追加予定' })).toHaveAttribute(
    'title',
    '追加予定の下書き',
  )
  await draftCard.locator('.task-item').click()
  await page
    .getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '編集' })
    .click()

  const savedDraftDialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await expect(
    savedDraftDialog.getByRole('checkbox', { name: '削除予定にする' }),
  ).toHaveCount(0)
  await expect(
    savedDraftDialog.getByRole('button', { name: '下書きを更新' }),
  ).toBeVisible()
  await savedDraftDialog
    .getByRole('textbox', { name: 'タイトル' })
    .fill('破棄される未保存入力')
  await savedDraftDialog.getByRole('button', { name: '戻る' }).click()
  await page
    .getByRole('alertdialog', { name: '入力内容を破棄しますか？' })
    .getByRole('button', { name: '入力内容を破棄' })
    .click()
  await expect(draftCard).toContainText(savedTitle)
  await expect(draftCard).not.toContainText('破棄される未保存入力')

  await page.getByRole('button', { name: '変更内容（1）' }).click()
  await page.getByRole('dialog', { name: '変更内容' })
    .getByRole('button', { name: '反映を確認' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '変更を反映' }).click()
  await expect(draftCard).toHaveCount(0)
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const activeCard = page.locator('.task-entry').filter({ hasText: savedTitle })
  await page.evaluate(() =>
    (globalThis as unknown as { scrollTo(x: number, y: number): void }).scrollTo(
      0,
      240,
    ),
  )
  const originalScrollY = await page.evaluate(
    () => (globalThis as unknown as { scrollY: number }).scrollY,
  )
  await activeCard.locator('.task-item').click()
  const detailDialog = page.getByRole('dialog', { name: 'タスクの詳細' })
  await expect(page.locator('html')).toHaveClass(/page-scroll-locked/)
  await expect(detailDialog.getByRole('button', { name: '編集履歴' })).toBeVisible()
  await detailDialog.getByRole('button', { name: '編集履歴' }).click()
  const historyDialog = page.getByRole('dialog', { name: 'タスクの編集履歴' })
  await expect(historyDialog).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/page-scroll-locked/)
  await historyDialog.getByRole('button', { name: 'タスクの詳細に戻る' }).click()
  await expect(page.getByRole('dialog', { name: 'タスクの詳細' })).toBeVisible()
  await page
    .getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '閉じる' })
    .click()
  await expect(page.locator('html')).not.toHaveClass(/page-scroll-locked/)
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as unknown as { scrollY: number }).scrollY),
    )
    .toBe(originalScrollY)

  await activeCard.locator('.task-item').click()
  const activeDetailDialog = page.getByRole('dialog', { name: 'タスクの詳細' })
  await activeDetailDialog.getByRole('button', { name: '編集', exact: true }).click()

  const updateDialog = page.getByRole('dialog', { name: 'タスクを編集' })
  await expect(
    updateDialog.getByRole('button', { name: '下書きを更新' }),
  ).toBeVisible()
  await expect(
    updateDialog.locator('dt').filter({ hasText: '変更適用範囲' }),
  ).toBeVisible()
  await expect(
    updateDialog.getByRole('combobox', { name: '変更適用範囲' }),
  ).toHaveCount(0)
  const removalCheckbox = updateDialog.getByRole('checkbox', {
    name: '削除予定にする',
  })
  await removalCheckbox.check()
  await expect(
    page.getByRole('dialog', { name: 'タスクを削除予定にしますか？' }),
  ).toHaveCount(0)
  await expect(updateDialog.getByRole('textbox', { name: 'タイトル' })).toBeDisabled()
  await expect(updateDialog.locator('input[type="date"]')).toBeDisabled()
  await expect(
    updateDialog.getByRole('button', { name: '期限をクリア' }),
  ).toBeDisabled()
  await expect(
    updateDialog.getByRole('textbox', { name: '関連する授業' }),
  ).toBeDisabled()
  await updateDialog.getByRole('button', { name: '削除予定にする' }).click()
  await expect(
    page.getByText('このタスクだけが削除予定になります。', { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.locator('.task-removal-cascade-surface').filter({ hasText: savedTitle }),
  ).toHaveCount(1)
})

test('Task add/edit supports zero, one, and multiple Notes and returns from Task Note detail', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'Chromium desktop Task Note journey',
  )

  const zeroTitle = `Issue 60 Task zero ${Date.now()}`
  const oneTitle = `Issue 60 Task one ${Date.now()}`
  const multipleTitle = `Issue 60 Task multiple ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const addTask = async (title: string, noteBodies: string[]) => {
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

  await addTask(zeroTitle, [])
  await addTask(oneTitle, ['1件目のTask Note'])
  await addTask(multipleTitle, ['複数Noteの1件目', '', '複数Noteの2件目'])

  await page.getByRole('button', { name: /変更内容（/ }).click()
  const review = page.getByRole('dialog', { name: '変更内容' })
  await review.getByRole('button', { name: '反映を確認' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '変更を反映' }).click()
  await expect(
    page.getByRole('button', { name: 'この日の予定を編集' }),
  ).toBeVisible()
  await expect(page.locator('.task-entry').filter({ hasText: multipleTitle })).toHaveCount(1)

  const multipleCard = page.locator('.task-entry').filter({ hasText: multipleTitle })
  await multipleCard.locator('.task-item').click()
  const detail = page.getByRole('dialog', { name: 'タスクの詳細' })
  const relatedNotes = detail.getByRole('button', { name: 'ノートの詳細を開く' })
  await expect(relatedNotes).toHaveCount(2)
  const openedNoteBodies = []
  for (const index of [0, 1]) {
    await relatedNotes.nth(index).click()
    const noteDetail = page.getByRole('dialog', { name: 'ノートの詳細' })
    const body = noteDetail.locator('.note-detail-body')
    await expect(body).toHaveText(/複数Noteの[12]件目/)
    openedNoteBodies.push((await body.textContent())?.trim())
    await noteDetail.getByRole('button', { name: 'タスクの詳細に戻る' }).click()
    await expect(detail).toBeVisible()
  }
  expect(new Set(openedNoteBodies)).toEqual(
    new Set(['複数Noteの1件目', '複数Noteの2件目']),
  )

  await detail.getByRole('button', { name: '閉じる' }).click()
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await multipleCard.locator('.task-item').click()
  await page
    .getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '編集', exact: true })
    .click()

  const editDetail = page.getByRole('dialog', { name: 'タスクを編集' })
  await expect(editDetail.getByRole('textbox', { name: 'タイトル' })).toHaveValue(multipleTitle)
  await expect(
    editDetail.locator('dt').filter({ hasText: '変更適用範囲' }),
  ).toBeVisible()
  await expect(editDetail.getByRole('combobox', { name: '変更適用範囲' })).toHaveCount(0)
})

test('reflected Task removal confirms active Notes and groups the cascade in Daily Plan', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'Chromium desktop Task removal journey',
  )

  const title = `Issue 61 Task ${Date.now()}`
  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const addDialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await addDialog.getByRole('textbox', { name: 'タイトル' }).fill(title)
  await addDialog.getByRole('combobox', { name: '変更適用範囲' }).selectOption('class')
  for (const body of ['削除確認ノート1', '削除確認ノート2']) {
    await addDialog.getByRole('button', { name: '＋ノートを追加' }).click()
    const fields = addDialog.getByRole('textbox', { name: /ノート本文/ })
    await fields.nth((await fields.count()) - 1).fill(body)
  }
  await addDialog.getByRole('button', { name: '下書きを保存' }).click()
  await page.getByRole('button', { name: /変更内容（/ }).click()
  const review = page.getByRole('dialog', { name: '変更内容' })
  await review.getByRole('button', { name: '反映を確認' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '変更を反映' }).click()
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  const taskCard = page.locator('.task-entry').filter({ hasText: title })
  await taskCard.locator('.task-item').click()
  await page.getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '編集', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: 'タスクを編集' })
  await editDialog.getByRole('button', { name: 'ノートの詳細を開く' }).first().click()
  const noteEditDialog = page.getByRole('dialog', { name: 'ノートの詳細' })
  await noteEditDialog.getByRole('checkbox', { name: '削除予定にする' }).check()
  await noteEditDialog.getByRole('button', { name: '下書きを更新' }).click()
  await editDialog.getByRole('button', { name: '戻る' }).click()
  await page.getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '閉じる' }).click()
  await expect(taskCard).not.toHaveClass(/task-removal-cascade-surface/)
  await expect(taskCard.locator('.note-removal-draft')).toHaveCount(1)
  await expect(taskCard.locator('.note-removal-draft').getByRole('img', {
    name: '削除対象のノート',
  })).toBeVisible()

  await taskCard.locator('.task-item').click()
  await page.getByRole('dialog', { name: 'タスクの詳細' })
    .getByRole('button', { name: '編集', exact: true }).click()
  const restoredEditDialog = page.getByRole('dialog', { name: 'タスクを編集' })
  const removalCheckbox = restoredEditDialog.getByRole('checkbox', {
    name: '削除予定にする',
  })
  await restoredEditDialog.getByRole('button', { name: '＋ノートを追加' }).click()
  await removalCheckbox.check()

  const confirmation = page.getByRole('dialog', {
    name: 'タスクを削除予定にしますか？',
  })
  await expect(confirmation).toContainText('関連するノート2件も削除予定になります。')
  await expect(confirmation).toContainText('削除確認ノート1')
  await expect(confirmation).toContainText('削除確認ノート2')
  await expect(restoredEditDialog.getByRole('textbox', { name: 'タイトル' })).toBeDisabled()
  await expect(restoredEditDialog.locator('input[type="date"]')).toBeDisabled()
  await expect(
    restoredEditDialog.getByRole('button', { name: '期限をクリア' }),
  ).toBeDisabled()
  await expect(
    restoredEditDialog.getByRole('textbox', { name: '関連する授業' }),
  ).toBeDisabled()
  await expect(
    restoredEditDialog.getByRole('textbox', { name: /ノート本文/ }),
  ).toBeDisabled()
  await expect(
    restoredEditDialog.getByRole('button', { name: '＋ノートを追加' }),
  ).toBeDisabled()
  await expect(
    restoredEditDialog.getByRole('button', { name: 'ノートの詳細を開く' }),
  ).toHaveCount(0)

  await confirmation.getByRole('button', { name: 'キャンセル' }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(removalCheckbox).not.toBeChecked()
  await expect(restoredEditDialog.getByRole('textbox', { name: 'タイトル' })).toBeEnabled()
  await removalCheckbox.check()
  await page.getByRole('dialog', { name: 'タスクを削除予定にしますか？' })
    .getByRole('button', { name: '削除予定にする' }).click()
  await expect(removalCheckbox).toBeChecked()
  await restoredEditDialog.getByRole('button', { name: '削除予定にする' }).click()

  const cascade = page.getByRole('group', {
    name: 'タスクと関連ノートはタスクの削除に伴い削除予定です',
  })
  await expect(cascade).toBeVisible()
  await expect(cascade.getByRole('img', {
    name: '削除対象のタスクと関連ノート',
  })).toBeVisible()
  await expect(cascade.getByText('削除確認ノート1')).toBeVisible()
  await expect(cascade.getByText('削除確認ノート2')).toBeVisible()
  await expect(cascade.locator('.note-cascade-removal')).toHaveCount(2)
  await expect(cascade.locator('.note-cascade-removal').nth(0)).toHaveClass(/sr-only/)
  await expect(cascade.locator('.note-cascade-removal').nth(1)).toHaveClass(/sr-only/)
})

test('browser back uses the same dirty-input guard and preserves the page scroll position', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'Chromium desktop dialog stack journey',
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()
  await page.getByRole('button', { name: 'タスクを追加' }).click()

  const dialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await dialog.getByRole('textbox', { name: 'タイトル' }).fill('戻る操作テスト')
  await page.goBack()

  const discardDialog = page.getByRole('alertdialog', {
    name: '入力内容を破棄しますか？',
  })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: '編集を続ける' }).click()
  await expect(dialog.getByRole('textbox', { name: 'タイトル' })).toHaveValue(
    '戻る操作テスト',
  )

  await page.keyboard.press('Escape')
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: '入力内容を破棄' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const cleanDialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await cleanDialog.getByRole('button', { name: '戻る' }).click()
  await expect(cleanDialog).toHaveCount(0)
})

test.describe('pointer state separation', () => {
  test('keeps hover styling and keyboard focus visible on desktop', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      browserName !== 'chromium' || isMobile,
      'Chromium desktop pointer-state journey',
    )

    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'メニュー' })
    await menuButton.hover()
    await expect(menuButton).toHaveCSS(
      'background-color',
      'rgb(248, 250, 251)',
    )

    await menuButton.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(menuButton).toBeFocused()
    await expect(menuButton).toHaveCSS('outline-style', 'solid')
    await expect(menuButton).toHaveCSS('outline-width', '2px')

    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    const taskAddButton = page.getByRole('button', { name: 'タスクを追加' })
    await taskAddButton.scrollIntoViewIfNeeded()
    const taskAddBox = await taskAddButton.boundingBox()
    expect(taskAddBox).not.toBeNull()
    if (!taskAddBox) throw new Error('Task add button is not measurable')

    await page.mouse.move(
      taskAddBox.x + taskAddBox.width / 2,
      taskAddBox.y + taskAddBox.height / 2,
    )
    await page.mouse.down()
    await expect(taskAddButton).toHaveCSS(
      'background-color',
      'rgb(232, 245, 246)',
    )
    await page.mouse.up()
    await expect(
      page.getByRole('dialog', { name: 'タスクを追加' }),
    ).toBeVisible()
  })

  test('does not keep desktop hover styling after a touch tap', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      browserName !== 'webkit' || !isMobile,
      'WebKit iPhone pointer-state journey',
    )

    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'メニュー' })
    await menuButton.tap()
    await expect(
      page.getByRole('button', { name: 'ほかの範囲を参照' }),
    ).toBeVisible()

    await expect(menuButton).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    )
  })
})

test.describe('WebKit mobile editors', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'webkit' || !isMobile,
    'WebKit mobile regression journey',
  )

  test('keeps primary and task editors usable inside the viewport', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '編集中' }),
    ).toBeVisible()

    await page.getByRole('button', { name: /^1限/ }).click()
    const layerDialog = page.getByRole('dialog', {
      name: '時間割の変更状況',
    })
    await expect(layerDialog).toBeVisible()
    const editableLayer = layerDialog
      .getByRole('button', { name: /時間割を編集/ })
      .first()
    await expect(editableLayer).toBeVisible()
    await editableLayer.click()

    const timetableDialog = page.getByRole('dialog', { name: '時間割変更' })
    const changeDateInput = timetableDialog.getByRole('textbox', {
      name: '変更対象日',
    })
    await expect(timetableDialog).toBeVisible()
    await expect(changeDateInput).toBeInViewport()
    const viewport = page.viewportSize()
    const changeDateBox = await changeDateInput.boundingBox()
    expect(viewport).not.toBeNull()
    expect(changeDateBox).not.toBeNull()
    if (viewport && changeDateBox) {
      expectBoxWithinViewport(changeDateBox, viewport.width)
    }
    await expect(
      timetableDialog.getByRole('button', { name: '閉じる' }),
    ).toHaveCount(0)
    await timetableDialog.getByRole('button', { name: '戻る' }).click()
    await expect(timetableDialog).toHaveCount(0)
    await expect(layerDialog).toBeVisible()
    await layerDialog.getByRole('button', { name: '閉じる' }).click()
    await expect(layerDialog).toHaveCount(0)

    await page.getByRole('button', { name: 'タスクを追加' }).click()

    const dialog = page.getByRole('dialog', { name: 'タスクを追加' })
    const titleInput = dialog.getByRole('textbox', { name: 'タイトル' })
    const dueDateInput = dialog.getByRole('textbox', { name: '期限' })
    const clearDueDateButton = dialog.getByRole('button', {
      name: '期限をクリア',
    })

    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: '戻る' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '閉じる' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: '下書きを保存' })).toBeVisible()
    await expect(titleInput).toBeInViewport()
    await expect(dueDateInput).toBeInViewport()
    await expect(clearDueDateButton).toBeInViewport()
    const dialogBox = await dialog.boundingBox()
    const headerBox = await dialog.locator('.editor-dialog-header').boundingBox()
    expect(viewport).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    expect(headerBox).not.toBeNull()
    if (viewport && dialogBox && headerBox) {
      expect(dialogBox.height).toBeLessThanOrEqual(viewport.height)
      expect(headerBox.y).toBeGreaterThanOrEqual(0)
      expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(
        viewport.height + 1,
      )
    }
    await expect(dialog.locator('.editor-dialog-body')).toHaveCSS(
      'overflow-y',
      'auto',
    )
    if (viewport) {
      const documentWidth = await page.evaluate(
        () =>
          (
            globalThis as unknown as {
              document: { documentElement: { scrollWidth: number } }
            }
          ).document.documentElement.scrollWidth,
      )
      expect(documentWidth).toBeLessThanOrEqual(viewport.width + 1)
    }

    await titleInput.fill('WebKit mobile smoke')
    const validDueDate = await dueDateInput.getAttribute('min')
    if (!validDueDate) throw new Error('Task due-date lower bound is missing')
    await dueDateInput.fill(validDueDate)
    await expect(dueDateInput).toHaveValue(validDueDate)

    const [titleBox, dueDateBox, clearDueDateBox] = await Promise.all([
      titleInput.boundingBox(),
      dueDateInput.boundingBox(),
      clearDueDateButton.boundingBox(),
    ])

    expect(viewport).not.toBeNull()
    expect(titleBox).not.toBeNull()
    expect(dueDateBox).not.toBeNull()
    expect(clearDueDateBox).not.toBeNull()

    if (viewport && titleBox && dueDateBox && clearDueDateBox) {
      for (const box of [titleBox, dueDateBox, clearDueDateBox]) {
        expectBoxWithinViewport(box, viewport.width)
      }
      expect(dueDateBox.x + dueDateBox.width).toBeLessThanOrEqual(
        clearDueDateBox.x + 1,
      )
    }

    await clearDueDateButton.click()
    await expect(dueDateInput).toHaveValue('')
    await dialog.getByRole('button', { name: '戻る' }).click()
    const discardDialog = page.getByRole('alertdialog', {
      name: '入力内容を破棄しますか？',
    })
    await expect(discardDialog).toBeVisible()
    await discardDialog.getByRole('button', { name: '入力内容を破棄' }).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: '編集を終了' }).click()
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
  })
})
