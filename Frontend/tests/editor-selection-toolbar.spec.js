import { test, expect } from '@playwright/test'

test('selection toolbar closes when the selection is cleared or focus moves away', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'selection-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const field = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await field.fill('Selected words')
  await field.press('ControlOrMeta+A')
  const toolbar = page.getByRole('toolbar', { name: 'Format selected text' })
  await expect(toolbar).toBeVisible()

  await field.evaluate(element => element.setSelectionRange(8, 8))
  await field.click()
  await expect(toolbar).toHaveCount(0)

  await field.press('ControlOrMeta+A')
  await expect(toolbar).toBeVisible()
  await page.getByRole('heading', { name: 'Write Story' }).click()
  await expect(toolbar).toHaveCount(0)
})
