import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:8790'
const chromiumStorageState =
  'test-results/playwright/auth/chromium.json'
const webkitIphoneStorageState =
  'test-results/playwright/auth/webkit-iphone.json'
const chromeStorageState =
  'test-results/playwright/auth/chrome.json'
const testLoginSecret = randomBytes(32).toString('hex')

process.env.TSUGI_BROWSER_TEST_LOGIN_SECRET = testLoginSecret

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: './tests/browser/global-setup.ts',
  globalTeardown: './tests/browser/global-teardown.ts',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'pnpm browser:test:serve',
    env: {
      PORTAL_BROWSER_TEST_PORT: '8790',
      TEST_LOGIN_SECRET: testLoginSecret,
    },
    url: `${baseURL}/api/auth/session`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      outputDir: 'test-results/playwright/chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: chromiumStorageState,
      },
    },
    {
      name: 'webkit-iphone',
      outputDir: 'test-results/playwright/webkit-iphone',
      use: {
        ...devices['iPhone 13'],
        storageState: webkitIphoneStorageState,
      },
    },
    {
      name: 'chrome',
      outputDir: 'test-results/playwright/chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: chromeStorageState,
      },
    },
  ],
})
