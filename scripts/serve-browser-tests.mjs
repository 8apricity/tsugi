import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const portalDirectory = join(repositoryRoot, 'apps', 'portal')
const persistenceDirectory = join(
  portalDirectory,
  '.wrangler',
  'browser-test',
)
const envFile = join(persistenceDirectory, '.dev.vars')
const packageManagerScript = process.env.npm_execpath
const port = Number(process.env.PORTAL_BROWSER_TEST_PORT ?? '8790')
const testLoginSecret =
  process.env.TEST_LOGIN_SECRET ?? randomBytes(32).toString('hex')

if (!packageManagerScript) {
  throw new Error('Run this server through pnpm browser:test:serve')
}

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('PORTAL_BROWSER_TEST_PORT must be an available user port')
}

if (!/^[A-Za-z0-9._~-]{32,256}$/.test(testLoginSecret)) {
  throw new Error(
    'TEST_LOGIN_SECRET must be 32-256 URL-safe characters for browser tests',
  )
}

const relativePersistenceDirectory = relative(
  portalDirectory,
  persistenceDirectory,
)
if (
  relativePersistenceDirectory.startsWith(`..${sep}`) ||
  relativePersistenceDirectory === '..' ||
  relativePersistenceDirectory === ''
) {
  throw new Error('Browser-test persistence path escaped Portal directory')
}

function runPnpm(args) {
  const result = spawnSync(process.execPath, [packageManagerScript, ...args], {
    cwd: portalDirectory,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

rmSync(persistenceDirectory, { recursive: true, force: true })
mkdirSync(persistenceDirectory, { recursive: true })

runPnpm([
  'exec',
  'wrangler',
  'd1',
  'migrations',
  'apply',
  'DB',
  '--local',
  '--persist-to',
  persistenceDirectory,
])
runPnpm([
  'exec',
  'wrangler',
  'd1',
  'execute',
  'DB',
  '--local',
  '--persist-to',
  persistenceDirectory,
  '--file',
  'db/seeds/test-students.sql',
  '--yes',
])
runPnpm(['run', 'build'])

writeFileSync(
  envFile,
  `TEST_LOGIN_ENABLED=true\nTEST_LOGIN_SECRET=${testLoginSecret}\n`,
  { encoding: 'utf8', mode: 0o600 },
)

const server = spawn(
  process.execPath,
  [
    packageManagerScript,
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    persistenceDirectory,
    '--env-file',
    envFile,
  ],
  {
    cwd: portalDirectory,
    env: process.env,
    stdio: 'inherit',
  },
)

let stopping = false
function stopServer() {
  if (stopping) return
  stopping = true
  server.kill()
}

process.on('SIGINT', stopServer)
process.on('SIGTERM', stopServer)

function removeEnvFile() {
  try {
    unlinkSync(envFile)
  } catch {
    // Persistence reset removes any stale local secret before the next run.
  }
}

server.on('error', (error) => {
  removeEnvFile()
  throw error
})

server.on('exit', (code, signal) => {
  removeEnvFile()

  if (!stopping && signal) process.kill(process.pid, signal)
  process.exitCode = code ?? (stopping ? 0 : 1)
})
