import { test, expect } from '@playwright/test'

for (const width of [320, 1280]) {
  test(`staff status filters default and reset to All at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const reports = ['pending', 'reviewing', 'dismissed', 'actioned'].map((status, index) => ({ _id: `report-${index}`, status, subjectType: 'post', reason: 'spam', details: `${status} report`, createdAt: '2026-10-01' }))
    const competitions = ['draft', 'open', 'judging', 'closed'].map((status, index) => ({ id: `contest-${index}`, title: `${status} contest`, status, competitionType: 'collective_choice', closeDate: '2026-11-01' }))
    const requests = []
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'staff-filter-test', user: 'Staff', role: 'admin' } })
      if (url.pathname === '/api/user/me') return route.fulfill({ json: { data: { id: 'staff-id', role: 'admin' } } })
      if (url.pathname === '/api/staff/reports') {
        requests.push(url.searchParams.get('status'))
        return route.fulfill({ json: { data: url.searchParams.get('status') === 'all' ? reports : reports.filter(item => item.status === url.searchParams.get('status')) } })
      }
      if (url.pathname === '/api/competition') return route.fulfill({ json: { data: url.searchParams.get('status') === 'closed' ? competitions.filter(item => item.status === 'closed') : competitions } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/staff')
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('article')).toHaveCount(4)
    expect(requests[0]).toBe('all')
    await panel.getByRole('button', { name: /^Filters/ }).click()
    const filter = page.getByRole('dialog', { name: 'Filter by status' })
    await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await filter.getByRole('button', { name: 'Pending', exact: true }).click()
    await expect(panel.getByRole('article')).toHaveCount(1)
    await expect(panel.getByText('pending report', { exact: true })).toBeVisible()
    await filter.getByRole('button', { name: 'Reset filters' }).click()
    await expect(panel.getByRole('article')).toHaveCount(4)
    await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Competitions', exact: true }).click()
    await expect(panel.getByRole('article')).toHaveCount(4)
    await panel.getByRole('button', { name: /^Filters/ }).click()
    await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await filter.getByRole('button', { name: 'Ongoing', exact: true }).click()
    await expect(panel.getByRole('article')).toHaveCount(3)
    await filter.getByRole('button', { name: 'Past', exact: true }).click()
    await expect(panel.getByRole('article')).toHaveCount(1)
    await expect(panel.getByRole('heading', { name: 'closed contest', exact: true })).toBeVisible()
    await filter.getByRole('button', { name: 'Reset filters' }).click()
    await expect(panel.getByRole('article')).toHaveCount(4)
    await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(panel.getByRole('article')).toHaveCount(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

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

test('canceling a competition cover selection keeps create and edit dialogs open', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'staff-cover-test', user: 'Staff', role: 'admin' } })
    if (path === '/api/user/me') return route.fulfill({ json: { data: { id: 'staff-id', role: 'admin' } } })
    if (path === '/api/competition') return route.fulfill({ json: { data: [{ id: '507f1f77bcf86cd799439030', title: 'Open contest', status: 'open', openDate: '2026-10-01', closeDate: '2026-11-01', competitionType: 'reader_choice', rules: [] }] } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/staff?staffTab=competitions')
  for (const [trigger, title] of [['Add competition', 'Create competition'], ['Edit', 'Edit competition']]) {
    await page.getByRole('button', { name: trigger, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: title })
    await dialog.locator('input[type="file"]').evaluate(input => { input.click = () => {} })
    await dialog.getByRole('button', { name: 'Choose image' }).click()
    await page.keyboard.press('Escape')
    await dialog.locator('input[type="file"]').evaluate(input => input.dispatchEvent(new Event('cancel', { bubbles: true })))
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(550)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
})
