import { test, expect } from '@playwright/test'

for (const role of ['regular', 'moderator', 'admin']) {
  for (const width of [390, 1280]) {
    test(`${role} account menu staff link at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'staff-menu-test', user: 'Test Member', email: 'member@example.test', role } })
        if (path === '/api/user/me') return route.fulfill({ json: { data: { role, displayName: 'Test Member', joinedAt: '2025-01-01', postCount: 0, followersCount: 0, followingCount: 0 } } })
        if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [], membership: { plan: 'free', status: 'inactive' } } } })
        if (path === '/api/v1/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
        if (path === '/api/staff/reports') return route.fulfill({ json: { data: [] } })
        return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
      })

      await page.goto('/profile', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('main').getByRole('link', { name: 'Open staff console' })).toHaveCount(0)
      if (width >= 768) {
        await page.getByRole('button', { name: 'Open account menu' }).click()
        const menu = page.getByRole('menu', { name: 'Account' })
        const staffLink = menu.getByRole('menuitem', { name: 'Staff console' })
        if (role === 'regular') await expect(staffLink).toHaveCount(0)
        else {
          await expect(staffLink).toHaveAttribute('href', '/staff')
          await expect(staffLink).toContainText('Moderation and operations')
          await staffLink.click()
          await expect(page).toHaveURL(/\/staff$/)
        }
      } else {
        await page.getByRole('button', { name: 'Account', exact: true }).click()
        const menu = page.getByRole('dialog', { name: 'Account', exact: true })
        const staffLink = menu.getByRole('link', { name: 'Staff console' })
        if (role === 'regular') await expect(staffLink).toHaveCount(0)
        else {
          await expect(staffLink).toHaveAttribute('href', '/staff')
          await staffLink.click()
          await expect(page).toHaveURL(/\/staff$/)
        }
      }
    })
  }
}

test('staff tabs follow URL, reload, and browser history', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'staff-tab-test', user: 'Staff', role: 'admin' } })
    if (path === '/api/user/me') return route.fulfill({ json: { data: { id: 'staff-id', role: 'admin' } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/staff?source=menu&staffTab=users')
  const tabs = page.getByRole('tablist', { name: 'Staff console sections' })
  await expect(tabs.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true')
  await tabs.getByRole('tab', { name: 'Competitions' }).click()
  await expect(page).toHaveURL(/\/staff\?source=menu&staffTab=competitions$/)
  await page.reload()
  await expect(tabs.getByRole('tab', { name: 'Competitions' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(tabs.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true')
  await page.goForward()
  await expect(tabs.getByRole('tab', { name: 'Competitions' })).toHaveAttribute('aria-selected', 'true')
})
