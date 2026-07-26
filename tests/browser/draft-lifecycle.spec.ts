import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  browserAuthStatePath,
  type BrowserAuthStateVariant,
} from './auth-state.js'

async function saveTaskDraft(page: Page, title: string) {
  await page.getByRole('button', { name: 'タスクを追加' }).click()
  const dialog = page.getByRole('dialog', { name: 'タスクを追加' })
  await dialog.getByRole('textbox', { name: 'タイトル' }).fill(title)
  await dialog
    .getByRole('combobox', { name: '変更適用範囲' })
    .selectOption('track')
  await dialog.getByRole('button', { name: '下書きを保存' }).click()
}

async function useStoredSession(
  page: Page,
  projectName: string,
  variant: BrowserAuthStateVariant,
) {
  const state = JSON.parse(
    await readFile(browserAuthStatePath(projectName, variant), 'utf8'),
  ) as {
    cookies: Parameters<ReturnType<Page['context']>['addCookies']>[0]
  }
  await page.context().clearCookies()
  await page.context().addCookies(state.cookies)
}

test.describe('draft lifecycle', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'Chromium desktop draft-lifecycle journey',
  )

  test('restores editing on reload and explicitly discards the workspace', async ({
    page,
  }) => {
    const title = '再読み込み後も残る下書き'
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTaskDraft(page, title)

    await page.reload()

    await expect(page.getByRole('status').filter({ hasText: '編集中' }))
      .toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /変更を反映（1）/ })).toBeVisible()

    await page.getByRole('button', { name: '編集を終了' }).click()
    const exitDialog = page.getByRole('alertdialog', {
      name: '下書きを削除して編集を終了しますか？',
    })
    await expect(exitDialog).toContainText(
      '保存中の下書き1件はこの端末から削除され、復元できません。',
    )
    await exitDialog.getByRole('button', { name: '編集を続ける' }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '編集を終了' }).click()
    await page
      .getByRole('alertdialog', {
        name: '下書きを削除して編集を終了しますか？',
      })
      .getByRole('button', { name: '下書きを削除して終了' })
      .click()

    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('下書き1件')).toHaveCount(0)

    await page.reload()
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
  })

  test('isolates workspaces by Student Account and clears one on logout', async ({
    page,
  }, testInfo) => {
    const title = '文科アカウントだけの下書き'
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTaskDraft(page, title)

    await useStoredSession(page, testInfo.project.name, 'secondary')
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)

    await useStoredSession(page, testInfo.project.name, 'relogin')
    await page.reload()
    await expect(page.getByRole('status').filter({ hasText: '編集中' }))
      .toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ログアウト' }).click()
    const logoutDialog = page.getByRole('alertdialog', {
      name: '下書きを削除してログアウトしますか？',
    })
    await expect(logoutDialog.getByRole('button', { name: '戻る' }))
      .toBeFocused()
    await page.keyboard.press('Escape')
    await expect(logoutDialog).toHaveCount(0)

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ログアウト' }).click()
    await page
      .getByRole('alertdialog', {
        name: '下書きを削除してログアウトしますか？',
      })
      .getByRole('button', { name: 'ログアウト' })
      .click()
    await expect(
      page.getByRole('heading', { name: '学校のメールでログイン' }),
    ).toBeVisible()

    await useStoredSession(page, testInfo.project.name, 'post-logout')
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
  })

  test('discards Reference Scope options from an ended Student Session', async ({
    page,
  }, testInfo) => {
    let optionRequestCount = 0
    let releaseFirstRequest: () => void = () => undefined
    const firstRequestGate = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    await page.route('**/api/daily-plans/reference/options', async (route) => {
      optionRequestCount += 1
      if (optionRequestCount !== 1) {
        await route.continue()
        return
      }
      await firstRequestGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ready',
          options: [{
            type: 'class',
            value: 'stale-class',
            label: '前のアカウントの組',
          }],
        }),
      }).catch(() => undefined)
    })

    await useStoredSession(page, testInfo.project.name, 'secondary')
    await page.goto('/')
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ほかの範囲を参照' }).click()
    const firstPicker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await expect(firstPicker.getByRole('status')).toContainText(
      '選べる範囲を読み込んでいます',
    )
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ログアウト' }).click()
    await expect(
      page.getByRole('heading', { name: '学校のメールでログイン' }),
    ).toBeVisible()
    releaseFirstRequest()

    await useStoredSession(page, testInfo.project.name, 'post-logout')
    await page.reload()
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ほかの範囲を参照' }).click()
    const secondPicker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await expect.poll(() => optionRequestCount).toBe(2)
    await expect(secondPicker.getByRole('combobox')).toBeVisible()
    await expect(secondPicker.getByText('前のアカウントの組')).toHaveCount(0)
  })

  test('retries the same Reference Scope after a Daily Plan error', async ({
    page,
  }) => {
    let requestCount = 0
    await page.route('**/api/daily-plans/reference?*', async (route) => {
      requestCount += 1
      if (requestCount <= 2) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'daily-plan-unavailable' }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ほかの範囲を参照' }).click()
    let picker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await picker.getByRole('button', { name: '参照する' }).click()

    const error = page.getByRole('alert').filter({
      hasText: '参照する予定を読み込めませんでした',
    })
    await expect(error).toBeVisible()
    await error.getByRole('button', { name: '範囲を選び直す' }).click()
    picker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await picker.getByRole('button', { name: '参照する' }).click()
    await expect.poll(() => requestCount).toBe(2)
    await expect(error).toBeVisible()

    await error.getByRole('button', { name: '再読み込み' }).click()
    await expect.poll(() => requestCount).toBe(3)
    await expect(page.getByText('参照中', { exact: true })).toBeVisible()
  })

  test('keeps Reference Scope read-only without ending the editing session', async ({
    page,
  }) => {
    const title = '参照中は見せない下書き'
    await page.goto('/')
    await page.getByRole('button', { name: 'この日の予定を編集' }).click()
    await saveTaskDraft(page, title)
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.getByLabel('変更下書きあり')).toBeVisible()

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ほかの範囲を参照' }).click()
    let picker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await expect(
      picker.getByRole('button', { name: '閉じる' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: 'ほかの範囲を参照' }).click()
    picker = page.getByRole('dialog', { name: 'ほかの範囲を参照' })
    await picker.getByRole('button', { name: '参照する' }).click()

    await expect(page.getByText('参照中', { exact: true }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '編集を終了' })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'この日の予定を編集' }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: /変更を反映（1）/ })).toHaveCount(0)
    await expect(page.getByLabel('下書き1件')).toHaveCount(0)
    await expect(page.getByLabel('変更下書きあり')).toHaveCount(0)
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByRole('button', { name: '自分の予定に戻る' }).click()
    await expect(page.getByRole('status').filter({ hasText: '編集中' }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '編集を終了' })).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  })
})
