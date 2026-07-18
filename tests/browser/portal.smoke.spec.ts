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
    await timetableDialog.getByRole('button', { name: '閉じる' }).click()
    await expect(timetableDialog).toHaveCount(0)
    await expect(layerDialog).toHaveCount(0)

    await page.getByRole('button', { name: 'タスクを追加' }).click()

    const dialog = page.getByRole('dialog', { name: 'タスクを追加' })
    const titleInput = dialog.getByRole('textbox', { name: 'タイトル' })
    const dueDateInput = dialog.getByRole('textbox', { name: '期限' })
    const clearDueDateButton = dialog.getByRole('button', {
      name: '期限をクリア',
    })

    await expect(dialog).toBeVisible()
    await expect(titleInput).toBeInViewport()
    await expect(dueDateInput).toBeInViewport()
    await expect(clearDueDateButton).toBeInViewport()
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
    await dialog.getByRole('button', { name: '閉じる' }).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: '編集を終了' }).click()
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
  })
})
