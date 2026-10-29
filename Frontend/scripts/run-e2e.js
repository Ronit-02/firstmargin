import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const backendRoot = path.resolve(frontendRoot, '../Backend')
const requireBackend = createRequire(path.join(backendRoot, 'package.json'))
const mongoose = requireBackend('mongoose')
const { createTemporaryDatabase, createTestEnvironment, prepareTemporaryDatabase, dropTemporaryDatabase } = requireBackend('./tests/support/temporary-database.js')

if (process.env.E2E_BASE_URL) throw new Error('E2E_BASE_URL is disabled: E2E tests must start their own servers and temporary database. Use npm run test:e2e.')

const target = createTemporaryDatabase()
const env = createTestEnvironment(target)
const apiPort = Number(process.env.E2E_API_PORT || 8096)
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3096)
if (![apiPort, frontendPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535) || apiPort === frontendPort) throw new Error('E2E ports must be distinct unprivileged local ports')
env.PORT = String(apiPort)
env.VITE_API_URL = `http://127.0.0.1:${apiPort}`
env.FRONTEND_URL = `http://127.0.0.1:${frontendPort}`
let child
let interrupted = false
const stop = () => {
  interrupted = true
  child?.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

function run(args, cwd) {
  if (interrupted) throw new Error('E2E run interrupted')
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      child = undefined
      if (code === 0) resolve()
      else reject(new Error(`Test subprocess failed (${signal || code})`))
    })
  })
}

const connection = mongoose.createConnection()
let owned = false
try {
  await connection.openUri(target.uri, { serverSelectionTimeoutMS: 5000 })
  await prepareTemporaryDatabase(connection, target)
  owned = true
  console.log(`E2E temporary database: ${target.name}`)
  await run(['scripts/seed-development.js'], backendRoot)
  await run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], frontendRoot)
} catch (error) {
  console.error(`E2E run failed: ${error.message}`)
  process.exitCode = 1
} finally {
  try {
    if (owned) {
      await dropTemporaryDatabase(connection, target)
      console.log(`Removed E2E temporary database: ${target.name}`)
    }
  } finally {
    await connection.close()
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}
