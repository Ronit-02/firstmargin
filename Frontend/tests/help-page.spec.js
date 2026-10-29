import { test, expect } from './support/ui-test.js'

async function mockApi(page, signedIn = false) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: [], selectedTopicSlugs: [] } } })
    if (path === '/api/auth/refresh-token') return route.fulfill(signedIn
      ? { json: { accessToken: 'help-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } }
      : { status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
}

for (const signedIn of [false, true]) {
  for (const width of [768, 1280]) {
    test(`Help and Settings are in the account menu for ${signedIn ? 'members' : 'guests'} at ${width}px`, async ({ page }) => {
      await mockApi(page, signedIn)
      await page.setViewportSize({ width, height: 600 })
      await page.goto('/shorts')
      const nav = page.getByRole('navigation', { name: 'Desktop primary navigation' })
      await expect(nav.getByRole('link', { name: 'Help', exact: true })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Open account menu' }).click()
      const menu = page.getByRole('menu', { name: 'Account' })
      const help = menu.getByRole('menuitem', { name: 'Help', exact: true })
      const settings = menu.getByRole('menuitem', { name: 'Settings', exact: true })
      await expect(help).toBeVisible()
      await expect(settings).toBeVisible()
      expect(await help.evaluate(element => element.nextElementSibling?.textContent)).toBe('Settings')
      await help.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/help$/)
      await expect(menu).toHaveCount(0)
      await expect(page.getByRole('main').getByRole('heading', { name: 'Help', exact: true })).toBeVisible()
      if (!signedIn && width === 1280) await page.screenshot({ path: 'test-results/help-desktop.png' })
      await page.getByRole('main').getByRole('link', { name: 'Open Settings' }).click()
      await expect(page).toHaveURL(/\/settings$/)
      await page.getByRole('button', { name: 'Open account menu' }).click()
      await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible()
    })
  }
}

for (const width of [320, 390]) {
  test(`public Help page fits ${width}px and links to membership`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 640 })
    if (width === 390) await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
    await page.goto('/help')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Help', exact: true })).toBeVisible()
    await expect(main.getByRole('heading', { level: 2 })).toHaveCount(7)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    if (width === 390) await page.screenshot({ path: 'test-results/help-mobile-dark.png' })
    await main.getByRole('link', { name: 'Membership perks' }).click()
    await expect(page).toHaveURL(/\/membership$/)
    await expect(main.getByRole('heading', { name: 'Your member perks' })).toBeVisible()
  })
}
