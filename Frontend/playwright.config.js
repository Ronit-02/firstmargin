import path from 'node:path'
import temporaryDatabase from '../Backend/tests/support/temporary-database.js'

if (process.env.E2E_BASE_URL) throw new Error('E2E_BASE_URL is disabled: browser tests require runner-owned servers')
temporaryDatabase.assertTemporaryDatabase({
  runId: process.env.FIRSTMARGIN_TEST_RUN_ID || '',
  name: process.env.DB_NAME || '',
  uri: process.env.MONGO_URI || '',
})

// Enforce isolation before loading frontend tooling, which is installed later in CI.
const { defineConfig, devices } = await import('@playwright/test')

const frontendRoot = path.resolve(import.meta.dirname)
const backendRoot = path.resolve(frontendRoot, '../Backend')
const apiOrigin = process.env.VITE_API_URL
const frontendOrigin = process.env.FRONTEND_URL
if (![apiOrigin, frontendOrigin].every(origin => /^http:\/\/127\.0\.0\.1:\d+$/.test(origin || ''))) throw new Error('E2E servers must use runner-owned loopback origins')
const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  FRONTEND_URL: frontendOrigin,
  VITE_API_URL: apiOrigin,
}

const managedWebServers = [
  {
    command: 'node server.js',
    cwd: backendRoot,
    url: `${apiOrigin}/api/post/feed?limit=1`,
    timeout: 120_000,
    env: e2eEnv,
    reuseExistingServer: false,
  },
  {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${new URL(frontendOrigin).port} --strictPort`,
    cwd: frontendRoot,
    url: frontendOrigin,
    timeout: 120_000,
    env: e2eEnv,
    reuseExistingServer: false,
  },
]

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/e2e',
  testMatch: ['**/critical-flow.spec.js', '**/e2e-isolation.spec.js', '**/notifications-recovery.spec.js'],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Several authenticated flows intentionally exercise the shared seeded demo
  // account. Keep browser verification deterministic instead of interleaving
  // mutations from multiple workers against that fixture.
  workers: 1,
  maxFailures: 3,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/e2e' }]] : 'list',
  use: {
    baseURL: frontendOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Both local and CI runs must use the run-owned API and temporary database.
  webServer: managedWebServers,
})
