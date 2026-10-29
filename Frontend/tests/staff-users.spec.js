import { test, expect } from './support/ui-test.js'

test('staff role editor saves a permitted change and keeps removal unavailable', async ({ page }) => {
  const accounts = [
    { id: '507f1f77bcf86cd799439011', username: 'Regular Reader', email: 'reader@example.test', role: 'regular', accountStatus: 'active' },
    { id: '507f1f77bcf86cd799439012', username: 'Member Reader', email: 'member@example.test', role: 'premium', accountStatus: 'active' },
    { id: '507f1f77bcf86cd799439013', username: 'Member Writer', email: 'writer@example.test', role: 'premium', accountStatus: 'active' },
    { id: '507f1f77bcf86cd799439015', username: 'Admin Person', email: 'admin@example.test', role: 'admin', accountStatus: 'active' },
  ]
  const changes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/api/auth/refresh-token') return json({ accessToken: 'staff-test-token', user: 'Admin', email: 'admin@example.test', role: 'admin' })
    if (url.pathname === '/api/user/me') return json({ data: { id: accounts[3].id, role: 'admin', username: 'Admin' } })
    if (url.pathname === '/api/staff/reports') return json({ data: [] })
    if (url.pathname === '/api/competition') return json({ data: [] })
    if (url.pathname === '/api/v1/notifications') return json({ data: [], meta: { unreadCount: 0 } })
    if (url.pathname === '/api/v1/me/entitlements') return json({ data: { capabilities: [], membership: { plan: 'free', status: 'inactive' } } })
    if (url.pathname === '/api/staff/users' && route.request().method() === 'GET') {
      const role = url.searchParams.get('role')
      const filtered = role === 'all' ? accounts : accounts.filter(account => account.role === role)
      return json({ data: filtered, meta: { page: 1, pageSize: 25, total: filtered.length, hasMore: false } })
    }
    if (/^\/api\/staff\/users\/[^/]+\/role$/.test(url.pathname) && route.request().method() === 'PATCH') {
      const id = url.pathname.split('/')[4]
      const { role } = route.request().postDataJSON()
      changes.push(role)
      accounts.find(account => account.id === id).role = role
      return json({ data: { id, role } })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.goto('/staff', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Users' }).click()
  const usersPanel = page.getByRole('tabpanel', { name: 'Users content' })
  const panelBounds = await usersPanel.boundingBox()
  const filterBounds = await usersPanel.getByRole('button', { name: /^Filters/ }).boundingBox()
  const headingBounds = await usersPanel.getByRole('heading', { name: 'Users', exact: true }).boundingBox()
  expect(headingBounds.x + headingBounds.width).toBeLessThan(filterBounds.x)
  expect(panelBounds.x + panelBounds.width - filterBounds.x - filterBounds.width).toBeLessThanOrEqual(2)
  const selectRole = async label => {
    await page.getByRole('button', { name: /^Filters/ }).click()
    const filterDialog = page.getByRole('dialog', { name: 'Filter by role' })
    await filterDialog.getByRole('button', { name: label, exact: true }).click()
    await filterDialog.getByRole('button', { name: 'Close filters' }).click()
  }
  await selectRole('Members')
  await expect(page.getByText('Member Reader')).toBeVisible()
  await page.getByRole('button', { name: 'More options for Member Reader' }).click()
  await page.getByRole('menuitem', { name: 'Edit role' }).click()
  const memberDialog = page.getByRole('dialog', { name: 'Edit role' })
  await expect(memberDialog.getByRole('radio', { name: 'Member Current' })).toBeChecked()
  await expect(memberDialog.getByRole('radio', { name: 'Regular' })).toHaveCount(0)
  await memberDialog.getByRole('radio', { name: 'Exclusive writer' }).check()
  await memberDialog.getByRole('button', { name: 'Save role' }).click()
  await expect(memberDialog).toHaveCount(0)
  await expect(page.getByText('Member Reader')).toHaveCount(0)
  await page.getByRole('button', { name: 'More options for Member Writer' }).click()
  await page.getByRole('menuitem', { name: 'Edit role' }).click()
  await memberDialog.getByRole('radio', { name: 'Moderator' }).check()
  await memberDialog.getByRole('button', { name: 'Save role' }).click()
  await expect(memberDialog).toHaveCount(0)
  await expect(page.getByText('Member Writer')).toHaveCount(0)
  await selectRole('Regular')
  await page.getByRole('button', { name: 'More options for Regular Reader' }).click()
  await expect(page.getByRole('menuitem', { name: 'Remove user' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'Edit role' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit role' })
  await expect(dialog.getByText('Current', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save role' })).toBeDisabled()
  await dialog.getByRole('radio', { name: 'Exclusive writer' }).check()
  expect(changes).toEqual(['exclusive-writer', 'moderator'])
  await dialog.getByRole('button', { name: 'Save role' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('User role updated.').first()).toBeVisible()
  expect(changes).toEqual(['exclusive-writer', 'moderator', 'exclusive-writer'])
  await selectRole('Exclusive writers')
  await page.getByRole('button', { name: 'More options for Regular Reader' }).click()
  await page.getByRole('menuitem', { name: 'Edit role' }).click()
  await page.getByRole('dialog', { name: 'Edit role' }).getByRole('radio', { name: 'Regular' }).check()
  await page.getByRole('dialog', { name: 'Edit role' }).getByRole('button', { name: 'Save role' }).click()
  expect(changes).toEqual(['exclusive-writer', 'moderator', 'exclusive-writer', 'regular'])
})
