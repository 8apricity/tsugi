import { readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { request, type FullConfig } from '@playwright/test'

const fixedTestStudentAccountId =
  'test-student-2026-2-3-humanities-1'
const storageStateByProject = new Map([
  ['chromium', resolve('test-results/playwright/auth/chromium.json')],
  [
    'webkit-iphone',
    resolve('test-results/playwright/auth/webkit-iphone.json'),
  ],
  ['chrome', resolve('test-results/playwright/auth/chrome.json')],
])

function requestedProjectNames() {
  const names: string[] = []
  for (let index = 0; index < process.argv.length; index += 1) {
    const argument = process.argv[index]
    if (argument === '--project' && process.argv[index + 1]) {
      names.push(process.argv[index + 1])
      index += 1
    } else if (argument.startsWith('--project=')) {
      names.push(argument.slice('--project='.length))
    }
  }
  return names
}

export default async function globalSetup(config: FullConfig) {
  const testLoginSecret = process.env.TSUGI_BROWSER_TEST_LOGIN_SECRET

  if (!testLoginSecret) {
    throw new Error('Browser-test login secret is missing')
  }

  const requestedNames = requestedProjectNames()
  const projects = requestedNames.length
    ? config.projects.filter((project) => requestedNames.includes(project.name))
    : config.projects
  const authenticatedProjects = projects.flatMap((project) => {
    const storageState = storageStateByProject.get(project.name)
    if (!storageState) return []

    const baseURL = project.use.baseURL
    if (typeof baseURL !== 'string') {
      throw new Error(
        `${project.name} browser-test base URL is missing`,
      )
    }

    return [{ baseURL, name: project.name, storageState }]
  })

  if (authenticatedProjects.length === 0) {
    throw new Error('No authenticated browser-test project was selected')
  }

  await rm(dirname(authenticatedProjects[0].storageState), {
    recursive: true,
    force: true,
  })

  for (const project of authenticatedProjects) {
    const apiRequestContext = await request.newContext({
      baseURL: project.baseURL,
    })
    try {
      const response = await apiRequestContext.post('/api/test/login', {
        data: { studentAccountId: fixedTestStudentAccountId },
        headers: { 'x-test-login-secret': testLoginSecret },
      })

      if (!response.ok()) {
        throw new Error(
          `Node-side ${project.name} test login failed with status ${response.status()}`,
        )
      }

      await apiRequestContext.storageState({ path: project.storageState })

      const persistedState = await readFile(project.storageState, 'utf8')
      if (persistedState.includes(testLoginSecret)) {
        await rm(project.storageState, { force: true })
        throw new Error(
          `${project.name} storage state contained test-login secret`,
        )
      }
    } finally {
      await apiRequestContext.dispose()
    }
  }
}
