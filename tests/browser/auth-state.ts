import { resolve } from 'node:path'

export const browserTestAuthProjectNames = new Set([
  'chromium',
  'webkit-iphone',
  'chrome',
])

export type BrowserAuthStateVariant =
  | 'default'
  | 'secondary'
  | 'relogin'
  | 'post-logout'

export function browserAuthStatePath(
  projectName: string,
  variant: BrowserAuthStateVariant = 'default',
) {
  const suffix = variant === 'default' ? '' : `-${variant}`
  return resolve(`test-results/playwright/auth/${projectName}${suffix}.json`)
}
