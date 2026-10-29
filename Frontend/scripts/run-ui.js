import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const requireBackend = createRequire(new URL('../../Backend/package.json', import.meta.url))
const { createTemporaryDatabase, createTestEnvironment } = requireBackend('./tests/support/temporary-database.js')
const scope = process.argv[2] || 'smoke'
if (!['critical', 'smoke', 'features', 'responsive', 'all'].includes(scope)) throw new Error('Unknown UI test suite')
if (process.env.E2E_BASE_URL) throw new Error('UI tests cannot attach to existing app servers')
const env = {
  ...createTestEnvironment(createTemporaryDatabase('e2e', 'mongodb://127.0.0.1:27017')),
  MONGO_URI: '', DB_NAME: '', FIRSTMARGIN_TEST_RUN_ID: '',
  FIRSTMARGIN_UI_RUN: '1', UI_TEST_SUITE: scope, VITE_API_URL: 'http://127.0.0.1:9',
}
const args = process.argv.slice(3)
if (!args.some(arg => arg === '--config' || arg.startsWith('--config='))) args.unshift('--config', 'playwright.ui.config.js')
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env, stdio: 'inherit',
})
const stop = () => child.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.once('error', error => { console.error(error.message); process.exitCode = 1 })
child.once('exit', code => {
  process.exitCode = code ?? 1
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
})
