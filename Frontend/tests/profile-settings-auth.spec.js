import { test, expect } from './support/ui-test.js'

test.beforeEach(async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    if (new URL(route.request().url()).pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
})

test('Google sign-in control follows the available form width on resize', async ({ page }) => {
  await page.addInitScript(() => {
    window.google = { accounts: { id: {
      initialize() {},
      renderButton(container, options) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Continue with Google'
        button.style.width = `${options.width}px`
        container.appendChild(button)
      },
    } } }
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
  const google = page.getByRole('button', { name: 'Continue with Google' })
  // Identity is optional in environments without a configured public client ID.
  if (await google.count() === 0) { test.skip(true, 'Google client ID is not configured'); return }
  await expect(google).toBeVisible()
  await expect.poll(async () => {
    const button = await google.boundingBox()
    const form = await page.locator('#auth-form').boundingBox()
    return button && form ? Math.abs(button.width - form.width) < 1 : false
  }).toBe(true)
  await page.setViewportSize({ width: 320, height: 568 })
  await expect.poll(async () => {
    const bounds = await google.boundingBox()
    const form = await page.locator('#auth-form').boundingBox()
    if (!bounds || !form) return false
    return Math.abs(bounds.x - form.x) < 1 && Math.abs(bounds.width - form.width) < 1
  }).toBe(true)
})

for (const width of [320, 390, 1280]) {
  test(`guest profile, private draft prompts, and settings at ${width}px`, async ({ page }) => {
    const privateReads = []
    page.on('request', request => { if (/^\/api\/(user|drafts|v1\/me)/.test(new URL(request.url()).pathname)) privateReads.push(request.url()) })
    await page.setViewportSize({ width, height: 735 })
    await page.goto('/profile')
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Sign In', exact: true })).toHaveCount(1)
    await expect(main.getByText('Sign in to view your profile.')).toBeVisible()
    expect(await main.getByRole('button', { name: 'Sign In', exact: true }).evaluate(element => getComputedStyle(element).color !== getComputedStyle(element).backgroundColor)).toBe(true)
    await expect(main.getByText('Sign Up', { exact: true })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Open app settings' })).toHaveCount(0)
    await page.goto('/settings')
    await expect(main.getByText('to manage your reading interests.', { exact: false })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Sign In', exact: true })).toHaveCount(0)
    await page.getByLabel('Language', { exact: true }).click()
    await expect(page.getByRole('option', { name: 'English', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'English', exact: true }).click()
    await page.getByLabel('Theme', { exact: true }).click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.goto('/studio?draft=private-draft')
    await expect(page).toHaveURL(/\/studio\?draft=/)
    await expect(main.getByText('Sign in to access your saved story.')).toBeVisible()
    expect(privateReads).toEqual([])
    await main.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
    await expect(page).toHaveURL(/\/studio\?draft=private-draft$/)
  })
}

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 360 }, { width: 768, height: 450 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  test(`auth forms and verification fit ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    const authForm = await page.locator('#auth-form').boundingBox()
    expect(authForm.x).toBeGreaterThanOrEqual(0)
    expect(authForm.x + authForm.width).toBeLessThanOrEqual(size.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (size.width >= 1024) await expect(page.getByTestId('auth-ink')).toBeVisible()
    else await expect(page.getByTestId('auth-ink')).toBeHidden()
    if (size.width >= 1024) {
      const form = await page.locator('#auth-form').boundingBox()
      expect(form.width).toBeGreaterThan(380)
      expect(form.width).toBeLessThanOrEqual(448)
      expect(form.x).toBeLessThan(size.width / 2)
      const column = await page.locator('#auth-form').evaluate(element => element.parentElement.getBoundingClientRect().toJSON())
      expect(form.x).toBeGreaterThanOrEqual(column.x)
    }
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByRole('textbox', { name: 'Full Name' }).fill('Test Reader')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Test-password-123')
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('Test-password-123')
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Enter Verification Code' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    for (let digit = 1; digit <= 6; digit++) {
      const input = page.getByRole('textbox', { name: `Verification digit ${digit}` })
      const bounds = await input.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width)
      await input.fill(String(digit))
    }
    await page.getByRole('button', { name: 'Verify Email' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Verify Email' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
