import { readFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { request, type FullConfig } from '@playwright/test'
import {
  browserAuthStatePath,
  browserTestAuthProjectNames,
  type BrowserAuthStateVariant,
} from './auth-state.js'

const fixedTestStudentAccountId =
  'test-student-2026-2-3-humanities-1'
const otherTestStudentAccountId =
  'test-student-2026-2-3-science-1'

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
    if (!browserTestAuthProjectNames.has(project.name)) return []

    const baseURL = project.use.baseURL
    if (typeof baseURL !== 'string') {
      throw new Error(
        `${project.name} browser-test base URL is missing`,
      )
    }

    return [{
      baseURL,
      name: project.name,
      storageState: browserAuthStatePath(project.name),
    }]
  })

  if (authenticatedProjects.length === 0) {
    throw new Error('No authenticated browser-test project was selected')
  }

  await rm(dirname(authenticatedProjects[0].storageState), {
    recursive: true,
    force: true,
  })

  for (const project of authenticatedProjects) {
    const loginStates = [
      {
        studentAccountId: fixedTestStudentAccountId,
        variant: 'default',
      },
      {
        studentAccountId: otherTestStudentAccountId,
        variant: 'secondary',
      },
      {
        studentAccountId: fixedTestStudentAccountId,
        variant: 'relogin',
      },
      {
        studentAccountId: fixedTestStudentAccountId,
        variant: 'post-logout',
      },
    ] satisfies Array<{
      studentAccountId: string
      variant: BrowserAuthStateVariant
    }>
    for (const loginState of loginStates) {
      const storageState = browserAuthStatePath(
        project.name,
        loginState.variant,
      )
      const apiRequestContext = await request.newContext({
        baseURL: project.baseURL,
      })
      try {
        const response = await apiRequestContext.post('/api/test/login', {
          data: { studentAccountId: loginState.studentAccountId },
          headers: { 'x-test-login-secret': testLoginSecret },
        })

        if (!response.ok()) {
          throw new Error(
            `Node-side ${project.name} test login failed with status ${response.status()}`,
          )
        }

        await apiRequestContext.storageState({ path: storageState })

        const persistedState = await readFile(storageState, 'utf8')
        if (persistedState.includes(testLoginSecret)) {
          await rm(storageState, { force: true })
          throw new Error(
            `${project.name} storage state contained test-login secret`,
          )
        }
      } finally {
        await apiRequestContext.dispose()
      }
    }
  }
}
