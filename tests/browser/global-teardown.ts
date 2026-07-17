import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

export default async function globalTeardown() {
  await rm(
    resolve('apps/portal/.wrangler/browser-test/.dev.vars'),
    { force: true },
  )
  delete process.env.TSUGI_BROWSER_TEST_LOGIN_SECRET
}
