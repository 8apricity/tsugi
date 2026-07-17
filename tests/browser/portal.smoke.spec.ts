import { expect, test } from '@playwright/test'

test('an unauthenticated Student sees School Email login', async ({ browser }) => {
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
