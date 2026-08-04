import { expect, test, type Locator } from '@playwright/test'

async function activate(control: Locator, isMobile: boolean) {
  if (isMobile) {
    await control.tap()
    return
  }
  await control.click()
}

test('an outside activation closes the header menu before opening a Daily Plan dialog', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')

  const menuButton = page.getByRole('button', { name: 'メニュー', exact: true })
  await activate(menuButton, isMobile)
  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toBeVisible()

  const uncoveredPeriod = page.getByRole('button', { name: /^7限/ })
  await activate(uncoveredPeriod, isMobile)

  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: '時間割の変更状況' }),
  ).toHaveCount(0)
  await expect(menuButton).toBeFocused()

  await activate(uncoveredPeriod, isMobile)
  await expect(
    page.getByRole('dialog', { name: '時間割の変更状況' }),
  ).toBeVisible()
})

test('a different kebab requires a second activation before its menu opens', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  await activate(page.getByRole('button', { name: /^1限/ }), isMobile)

  const dialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  const menuButtons = dialog.getByRole('button', { name: /のメニュー$/ })
  await expect(menuButtons).toHaveCount(4)

  const firstMenuButton = menuButtons.nth(0)
  const secondMenuButton = menuButtons.nth(1)
  await activate(firstMenuButton, isMobile)
  await expect(dialog.getByRole('menu')).toBeVisible()

  await activate(secondMenuButton, isMobile)
  await expect(dialog.getByRole('menu')).toHaveCount(0)
  await expect(firstMenuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(secondMenuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(firstMenuButton).toBeFocused()

  await activate(secondMenuButton, isMobile)
  await expect(dialog.getByRole('menu')).toBeVisible()
  await expect(secondMenuButton).toHaveAttribute('aria-expanded', 'true')
})

test('a layer menu closes before the period picker can open', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  await activate(page.getByRole('button', { name: /^1限/ }), isMobile)

  const dialog = page.getByRole('dialog', { name: '時間割の変更状況' })
  await activate(
    dialog.getByRole('button', { name: /のメニュー$/ }).first(),
    isMobile,
  )
  const periodPicker = dialog.getByRole('button', { name: '時限' })
  await activate(periodPicker, isMobile)

  await expect(dialog.getByRole('menu')).toHaveCount(0)
  await expect(dialog.locator('.period-wheel-popover')).toHaveCount(0)

  await activate(periodPicker, isMobile)
  await expect(dialog.locator('.period-wheel-popover')).toBeVisible()
})

test('the header menu closes before Task and Note details can open', async ({
  page,
  isMobile,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const taskTitle = `背後操作タスク-${suffix}`
  const noteBody = `背後操作ノート-${suffix}`
  await page.goto('/')
  await page.getByRole('button', { name: 'この日の予定を編集' }).click()

  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const taskEditor = page.getByRole('dialog', { name: 'タスクを追加' })
  await taskEditor.getByRole('textbox', { name: 'タイトル' }).fill(taskTitle)
  await taskEditor
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('class')
  await taskEditor.getByRole('button', { name: '下書きを保存' }).click()

  await page.getByRole('button', { name: 'ノートを追加' }).click()
  const noteEditor = page.getByRole('dialog', { name: 'ノートを追加' })
  await noteEditor.getByRole('textbox', { name: '本文' }).fill(noteBody)
  await noteEditor
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('class')
  await noteEditor.getByRole('button', { name: '下書きを保存' }).click()

  await page.getByRole('button', { name: '変更を反映（2）' }).click()
  await page
    .getByRole('dialog', { name: '変更を反映' })
    .getByRole('button', { name: '確定' })
    .click()

  const cases = [
    {
      control: page.locator('.task-entry').filter({ hasText: taskTitle })
        .getByRole('button', { name: new RegExp(taskTitle) }),
      dialogName: 'タスクの詳細',
    },
    {
      control: page.locator('.note-item').filter({ hasText: noteBody }),
      dialogName: 'ノートの詳細',
    },
  ]
  for (const detailCase of cases) {
    await activate(
      page.getByRole('button', { name: 'メニュー', exact: true }),
      isMobile,
    )
    await activate(detailCase.control, isMobile)
    await expect(
      page.getByRole('button', { name: 'ほかの範囲を参照' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('dialog', { name: detailCase.dialogName }),
    ).toHaveCount(0)

    await activate(detailCase.control, isMobile)
    const detail = page.getByRole('dialog', { name: detailCase.dialogName })
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: '閉じる' }).click()
  }
})

test('Escape closes an action menu and restores its trigger focus', async ({
  page,
}) => {
  await page.goto('/')

  const menuButton = page.getByRole('button', { name: 'メニュー', exact: true })
  await menuButton.click()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toBeFocused()

  await page.keyboard.press('Escape')

  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toHaveCount(0)
  await expect(menuButton).toBeFocused()
})

test('Tab leaves an action menu without trapping focus', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  const logout = page.getByRole('button', { name: 'ログアウト' })
  await logout.focus()
  await page.keyboard.press('Tab')

  await expect(logout).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^1限/ })).toBeFocused()
})

test('Shift+Tab leaves an action menu through its trigger', async ({ page }) => {
  await page.goto('/')

  const menuButton = page.getByRole('button', { name: 'メニュー', exact: true })
  await menuButton.click()
  const firstMenuItem = page.getByRole('button', {
    name: 'ほかの範囲を参照',
  })
  await firstMenuItem.focus()
  await page.keyboard.press('Shift+Tab')

  await expect(firstMenuItem).toHaveCount(0)
  await expect(menuButton).toBeFocused()
})

test('a mobile swipe closes the header menu and continues Daily Plan navigation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-iphone')
  await page.goto('/')
  await page.getByRole('button', { name: 'メニュー', exact: true }).tap()

  const title = page.getByRole('heading', { level: 1 })
  const initialTitle = await title.textContent()
  const surface = page.locator('.daily-plan-swipe-frame')
  await pointer(surface, 'pointerdown', 300, 260)
  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toHaveCount(0)
  await page.waitForTimeout(16)
  await pointer(surface, 'pointermove', 250, 256)
  await expect(surface).toHaveAttribute('data-motion', 'dragging')
  await pointer(surface, 'pointermove', 150, 254)
  await pointer(surface, 'pointerup', 130, 254)

  await expect(title).not.toHaveText(initialTitle ?? '')
})

test('an outside wheel closes the header menu without blocking page scroll', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop wheel interaction')
  await page.goto('/')

  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  const before = await page.evaluate(() =>
    (globalThis as unknown as { scrollY: number }).scrollY)
  await page.mouse.move(300, 400)
  await page.mouse.wheel(0, 600)

  await expect(
    page.getByRole('button', { name: 'ほかの範囲を参照' }),
  ).toHaveCount(0)
  await expect.poll(() => page.evaluate(() =>
    (globalThis as unknown as { scrollY: number }).scrollY))
    .toBeGreaterThan(before)
})

async function pointer(
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
) {
  await target.dispatchEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
  })
}
