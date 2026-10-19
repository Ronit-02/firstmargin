import { test, expect } from '@playwright/test'

const email = process.env.E2E_EMAIL || 'noah@inkrider.local'
const password = process.env.E2E_PASSWORD || 'InkRiderDemo123!'

test('a notifications service outage exposes the global server-unavailable recovery state', async ({ page }) => {
  await page.route('**/api/v1/notifications', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } }),
  }))

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('**/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

  await page.goto('/notifications', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'firstmargin is temporarily unavailable.' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('We can’t reach the server right now. Please try again in a moment.')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByText('Comments, follows, likes, answers, request updates, and competition results will appear here.')).toHaveCount(0)
})
