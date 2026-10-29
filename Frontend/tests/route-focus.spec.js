import { test, expect } from './support/ui-test.js'

test('phone Explore navigation exposes targets, active state and resets route focus', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/question' || url.pathname === '/api/competition') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/questions', { waitUntil: 'domcontentloaded' })
  const navigation = page.getByRole('navigation', { name: 'Explore sections' })

  const links = navigation.getByRole('link')
  await expect(links).toHaveText(['Trending', 'Questions', 'Competitions'])
  await expect(navigation.getByRole('link', { name: 'Questions' })).toHaveAttribute('aria-current', 'page')
  for (const link of await links.all()) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await navigation.getByRole('link', { name: 'Competitions' }).click()
  await expect(page).toHaveURL('/explore/competitions')
  await expect(navigation.getByRole('link', { name: 'Competitions' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page.locator('#main-content')).toHaveJSProperty('scrollTop', 0)
})
