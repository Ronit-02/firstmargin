import path from 'node:path'
import { readdirSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { manualOnlyPatterns, persistedSpecs, responsiveSpecs, smokeSpecs } from './tests/support/browser-suites.js'

if (process.env.FIRSTMARGIN_UI_RUN !== '1' || process.env.E2E_BASE_URL) throw new Error('Use npm run test:ui: mocked UI tests require their own server')
const scope = process.env.UI_TEST_SUITE
if (!['critical', 'smoke', 'features', 'responsive', 'all'].includes(scope)) throw new Error('Unknown UI test suite')
const frontendRoot = path.resolve(import.meta.dirname)
const all = readdirSync(path.join(frontendRoot, 'tests')).filter(name => name.endsWith('.spec.js') && !persistedSpecs.includes(name))
const selected = ['critical', 'smoke'].includes(scope) ? smokeSpecs : scope === 'responsive' ? responsiveSpecs : scope === 'features' ? all.filter(name => !responsiveSpecs.includes(name)) : all
const port = Number(process.env.UI_TEST_PORT || 3095)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('UI_TEST_PORT must be an unprivileged local port')
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/ui',
  testMatch: selected.map(name => `**/${name}`),
  grepInvert: scope === 'critical' ? manualOnlyPatterns : undefined,
  timeout: 30_000,
  // Query error states appear after the application's three retry delays (~7s).
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  maxFailures: process.env.CI ? 5 : 10,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/ui' }]] : 'list',
  use: { baseURL: origin, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off' },
  projects: [{ name: 'chromium-ui', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: frontendRoot, url: origin, timeout: 60_000, reuseExistingServer: false,
    env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:9' },
  },
})
