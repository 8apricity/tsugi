import { readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { request, type FullConfig } from '@playwright/test'

const fixedTestStudentAccountId =
  'test-student-2026-2-3-humanities-1'
const chromiumStorageState = resolve(
  'test-results/playwright/auth/chromium.json',
)

export default async function globalSetup(config: FullConfig) {
  const chromiumProject = config.projects.find(
    (project) => project.name === 'chromium',
  )
  const baseURL = chromiumProject?.use.baseURL
  const testLoginSecret = process.env.TSUGI_BROWSER_TEST_LOGIN_SECRET

  if (typeof baseURL !== 'string' || !testLoginSecret) {
    throw new Error('Chromium browser-test auth configuration is incomplete')
  }

  await rm(dirname(chromiumStorageState), { recursive: true, force: true })

  const apiRequestContext = await request.newContext({ baseURL })
  try {
    const response = await apiRequestContext.post('/api/test/login', {
      data: { studentAccountId: fixedTestStudentAccountId },
      headers: { 'x-test-login-secret': testLoginSecret },
    })

    if (!response.ok()) {
      throw new Error(
        `Node-side Chromium test login failed with status ${response.status()}`,
      )
    }

    await apiRequestContext.storageState({ path: chromiumStorageState })

    const persistedState = await readFile(chromiumStorageState, 'utf8')
    if (persistedState.includes(testLoginSecret)) {
      await rm(chromiumStorageState, { force: true })
      throw new Error('Chromium storage state contained test-login secret')
    }
  } finally {
    await apiRequestContext.dispose()
  }
}
