import { test, expect } from '@playwright/test'

const email = process.env.E2E_EMAIL || 'noah@inkrider.local'
const password = process.env.E2E_PASSWORD || 'InkRiderDemo123!'
const comment = `Critical flow comment ${Date.now()}`

test('reader can draft, publish, read, save, comment, and reload a short article', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  const [loginResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/auth/login')),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(loginResponse.status()).toBe(200)
  await page.waitForURL('**/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

  await page.goto('/studio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Write a story', exact: true }).click()
  await page.getByRole('dialog', { name: 'What do you want to write?' }).getByRole('button', { name: /^Short/ }).click()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  await page.getByPlaceholder('A focused idea…').fill('A browser-tested shorting flow')
  await page.getByRole('textbox', { name: 'Paragraph block', exact: true }).fill('This short article verifies the complete reader and writer journey from draft to durable discussion.')
  await expect.poll(() => new URL(page.url()).searchParams.get('draft')).toMatch(/^[a-f0-9]{24}$/)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const publishDialog = page.getByRole('dialog', { name: 'Publish short' })
  await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.waitForURL(/\/post\/[a-f0-9]{24}/, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  const reader = page.getByRole('dialog', { name: 'A browser-tested shorting flow', exact: true })
  const saveButton = reader.getByRole('button', { name: 'Save this short', exact: true })
  await expect(saveButton).toBeVisible()
  await saveButton.click()
  await page.getByRole('dialog', { name: 'Save story' }).getByRole('button', { name: 'Save story', exact: true }).click()
  await expect(reader.getByRole('button', { name: 'Manage saved short' })).toBeVisible({ timeout: 15_000 })

  await reader.getByRole('button', { name: /^Comments \(/ }).click()
  await reader.getByPlaceholder('Add your comment…').fill(comment)
  await reader.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText(comment, { exact: true })).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.getByRole('button', { name: 'Manage saved short' })).toBeVisible()
  await page.getByRole('button', { name: /^Comments \(/ }).click()
  await expect(page.getByText(comment, { exact: true })).toBeVisible()
})
