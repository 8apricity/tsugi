import { expect, test, type Page } from '@playwright/test'

async function scrollToPageBottom(page: Page) {
  await page.evaluate(() => {
    const browser = globalThis as unknown as {
      document: { body: { scrollHeight: number } }
      scrollTo(x: number, y: number): void
    }
    browser.scrollTo(0, browser.document.body.scrollHeight)
  })
}

function readPageScrollY(page: Page) {
  return page.evaluate(() =>
    (globalThis as unknown as { scrollY: number }).scrollY)
}

test.describe('authenticated Daily Plan dialog foundation', () => {
  test('guards Task editor exits and restores Daily Plan scroll', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()

    await scrollToPageBottom(page)
    const dailyPlanScrollY = await readPageScrollY(page)

    await page.getByRole('button', { name: 'タスクを追加' }).click()
    const editor = page.getByRole('dialog', { name: 'タスクを追加' })
    const header = editor.locator('.editor-dialog-header')

    await expect(header.getByRole('button', { name: '戻る' })).toBeVisible()
    const saveButton = header.getByRole('button', { name: '下書きを保存' })
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toHaveText('保存')
    if (isMobile) {
      await expect(saveButton).toHaveCSS('padding-left', '0px')
      await expect(saveButton).toHaveCSS('padding-right', '0px')
    }
    await expect(editor.getByRole('button', { name: '閉じる' })).toHaveCount(0)
    await expect(
      editor.locator('.editor-dialog-actions .button-primary'),
    ).toHaveCount(0)

    await editor.getByRole('textbox', { name: 'タイトル' }).fill('未保存の入力')
    await page.keyboard.press('Escape')
    const discard = page.getByRole('alertdialog', {
      name: '入力内容を破棄しますか？',
    })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: '編集を続ける' }).click()

    await page.goBack()
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: '入力内容を破棄' }).click()
    await expect(editor).toHaveCount(0)
    await expect.poll(() => readPageScrollY(page)).toBe(
      dailyPlanScrollY,
    )
  })

  test('shares fixed controls across Note and Timetable editors', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()

    await page.getByRole('button', { name: 'ノートを追加' }).click()
    const noteEditor = page.getByRole('dialog', { name: 'ノートを追加' })
    await expect(
      noteEditor.getByRole('button', { name: '戻る' }),
    ).toBeVisible()
    await expect(
      noteEditor.getByRole('button', { name: '下書きを保存' }),
    ).toBeVisible()
    await noteEditor.getByRole('button', { name: '戻る' }).click()

    await page.getByRole('button', { name: /^1限/ }).click()
    const layerDialog = page.getByRole('dialog', { name: '時間割の変更状況' })
    await layerDialog
      .getByRole('button', { name: /時間割を編集/ })
      .first()
      .click()

    const timetableEditor = page.getByRole('dialog', { name: '時間割変更' })
    const header = timetableEditor.locator('.editor-dialog-header')
    const body = timetableEditor.locator('.editor-dialog-body')
    await expect(header.getByRole('button', { name: '戻る' })).toBeVisible()
    await expect(
      header.getByRole('button', { name: '下書きを保存' }),
    ).toBeVisible()
    await expect(timetableEditor.getByRole('button', { name: '閉じる' })).toHaveCount(0)
    await expect(
      timetableEditor.locator('.editor-dialog-actions .button-primary'),
    ).toHaveCount(0)

    const viewport = page.viewportSize()
    const dialogBox = await timetableEditor.boundingBox()
    expect(viewport).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    if (viewport && dialogBox) {
      expect(dialogBox.y).toBeGreaterThanOrEqual(0)
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
        viewport.height + 1,
      )
      if (isMobile) {
        expect(dialogBox.x).toBe(0)
        expect(dialogBox.y).toBe(0)
        expect(dialogBox.width).toBe(viewport.width)
        expect(dialogBox.height).toBe(viewport.height)
      }
    }

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

    if (viewport) {
      for (const control of [
        header.getByRole('button', { name: '戻る' }),
        header.getByRole('button', { name: '下書きを保存' }),
      ]) {
        const controlBox = await control.boundingBox()
        expect(controlBox).not.toBeNull()
        if (controlBox) {
          expect(controlBox.x).toBeGreaterThanOrEqual(0)
          expect(controlBox.y).toBeGreaterThanOrEqual(0)
          expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(
            viewport.width + 1,
          )
          expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(
            viewport.height + 1,
          )
        }
      }
    }

    if (!isMobile) {
      await page.mouse.click(2, 2)
      await expect(timetableEditor).toBeVisible()
    }
  })

  test('keeps Daily Plan locked through detail and history stack', async ({
    page,
    browserName,
  }) => {
    const title = `ダイアログスタック検証-${browserName}`
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await page.getByRole('button', { name: 'タスクを追加' }).click()

    const editor = page.getByRole('dialog', { name: 'タスクを追加' })
    await editor.getByRole('textbox', { name: 'タイトル' }).fill(title)
    await editor
      .getByRole('combobox', { name: '変更適用範囲' })
      .selectOption('class')
    await editor.getByRole('button', { name: '下書きを保存' }).click()

    await page.getByRole('button', { name: /変更内容（1）/ }).click()
    await page
      .getByRole('dialog', { name: '変更内容' })
      .getByRole('button', { name: '反映を確認' })
      .click()
    const review = page.getByRole('dialog', { name: '最終確認' })
    page.once('dialog', (dialog) => dialog.accept())
    await review.getByRole('button', { name: '変更を反映' }).click()
    await expect(page.locator('.task-draft').filter({ hasText: title })).toHaveCount(0)

    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await scrollToPageBottom(page)
    const dailyPlanScrollY = await readPageScrollY(page)
    await page.locator('.task-entry').filter({ hasText: title }).last().click()

    const detail = page.getByRole('dialog', { name: 'タスクの詳細' })
    await detail.getByRole('button', { name: '編集履歴' }).click()
    const history = page.getByRole('dialog', { name: 'タスクの編集履歴' })
    await expect(history).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/page-scroll-locked/)

    await page.goBack()
    await expect(history).toHaveCount(0)
    await expect(detail).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/page-scroll-locked/)

    await page.goBack()
    await expect(detail).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveClass(/page-scroll-locked/)
    await expect.poll(() => readPageScrollY(page)).toBe(
      dailyPlanScrollY,
    )
  })
})
