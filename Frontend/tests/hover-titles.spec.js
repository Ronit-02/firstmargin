import { test, expect } from './support/ui-test.js'

test('navigation links and navbar controls expose native hover titles', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.abort('blockedbyclient'))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })

  const sidebar = page.getByRole('navigation', { name: 'Desktop primary navigation' })
  const home = sidebar.getByRole('link', { name: 'Home' })
  await home.hover()
  await expect(home).toHaveAttribute('title', 'Home')

  const browseSection = sidebar.getByRole('button', { name: 'Browse' })
  await browseSection.hover()
  await expect(browseSection).toHaveAttribute('aria-expanded', 'true')

  const logo = page.getByRole('link', { name: 'firstmargin home' })
  await logo.hover()
  await expect(logo).toHaveAttribute('title', 'firstmargin home')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = page.getByRole('navigation', { name: 'Mobile primary navigation' })
  const browse = mobile.getByRole('link', { name: 'Browse' })
  await browse.hover()
  await expect(browse).toHaveAttribute('title', 'Browse')
  const account = mobile.getByRole('button', { name: 'Account' })
  await expect(account).toBeEnabled()
  await account.hover()
  await expect(account).toHaveAttribute('title', 'Account')
})
