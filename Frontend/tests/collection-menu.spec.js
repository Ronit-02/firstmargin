import { test, expect } from './support/ui-test.js'

const collection = {
  id: '507f1f77bcf86cd799439030',
  title: 'Cities worth reading slowly',
  description: 'A deterministic collection fixture for keyboard coverage.',
  coverImage: null,
  postsCount: 4,
  visibility: 'public',
  isSaved: false,
  author: { username: 'Maya Sen' },
}

test('collection-card menu supports keyboard navigation and focus return', async ({ page }, testInfo) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [collection], meta: { nextCursor: null } }),
      })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/collections', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByRole('button', { name: `More options for ${collection.title}` })
  await trigger.click()

  const menu = page.getByRole('menu', { name: `Options for ${collection.title}` })
  const save = menu.getByRole('menuitem', { name: 'Save collection' })
  const share = menu.getByRole('menuitem', { name: 'Share link' })
  const hide = menu.getByRole('menuitem', { name: 'Not interested' })
  await expect(menu).toBeVisible()
  await expect(trigger.locator('svg circle')).toHaveCount(3)
  await expect(menu).toHaveCSS('width', '256px')
  for (const item of [save, share, hide]) await expect(item.locator('svg')).toHaveCount(1)
  await expect(save).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('collection-action-menu.png') })

  await save.press('ArrowDown')
  await expect(share).toBeFocused()
  await share.press('End')
  await expect(hide).toBeFocused()
  await hide.press('Home')
  await expect(save).toBeFocused()
  await save.press('Escape')

  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await hide.focus()
  await hide.press('Tab')
  await expect(menu).toBeHidden()

  await trigger.click()
  await page.getByRole('heading', { name: 'Collections', exact: true }).click()
  await expect(menu).toBeHidden()

  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ))
  expect(hasHorizontalOverflow).toBe(false)
})
