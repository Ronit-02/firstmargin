import { test, expect } from '@playwright/test'

test('a staff moderation service outage exposes the global server-unavailable recovery state', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'staff-test-token', user: 'Admin', email: 'admin@inkrider.local', role: 'admin' }) })
    if (url.pathname === '/api/user/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { role: 'admin', username: 'Admin' } }) })
    if (url.pathname === '/api/staff/reports') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Reports unavailable' }) })
    if (url.pathname === '/api/v1/notifications') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    return route.abort('blockedbyclient')
  })

  await page.goto('/staff', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'firstmargin is temporarily unavailable.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('We can’t reach the server right now.')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('staff lists reports and competitions before opening item actions', async ({ page }) => {
  const reports = {
    pending: [{ _id: 'report-pending', subjectType: 'post', reason: 'harassment', details: 'A reported story', status: 'pending', createdAt: '2026-10-18T08:00:00Z' }],
    reviewing: [{ _id: 'report-reviewing', subjectType: 'comment', reason: 'spam', details: 'A reported comment', status: 'reviewing', createdAt: '2026-10-18T09:00:00Z' }],
    dismissed: [{ _id: 'report-dismissed', subjectType: 'post', reason: 'other', details: 'A dismissed report', status: 'dismissed', createdAt: '2026-10-18T10:00:00Z' }],
  }
  let reviewPayload
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'staff-test-token', user: 'Admin', email: 'admin@inkrider.local', role: 'admin' } })
    if (url.pathname === '/api/user/me') return route.fulfill({ json: { data: { role: 'admin', username: 'Admin' } } })
    if (url.pathname === '/api/v1/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
    if (url.pathname === '/api/staff/reports' && request.method() === 'GET') return route.fulfill({ json: { data: reports[url.searchParams.get('status')] || [] } })
    if (url.pathname.endsWith('/reviews') && request.method() === 'POST') { reviewPayload = request.postDataJSON(); return route.fulfill({ json: { data: { status: 'reviewing' } } }) }
    if (url.pathname === '/api/competition') return route.fulfill({ json: { data: [
      { id: 'open-one', title: 'Current challenge', status: 'open', votingMode: 'readers', closeDate: '2026-11-01T00:00:00Z' },
      { id: 'past-one', title: 'Finished challenge', status: 'closed', votingMode: 'judges', closeDate: '2026-09-01T00:00:00Z' },
    ] } })
    if (url.pathname === '/api/competition/open-one' || url.pathname === '/api/competition/past-one') {
      const past = url.pathname.endsWith('past-one')
      return route.fulfill({ json: { data: { id: past ? 'past-one' : 'open-one', title: past ? 'Finished challenge' : 'Current challenge', description: 'A demo competition.', status: past ? 'closed' : 'open', votingMode: past ? 'judges' : 'readers', closeDate: past ? '2026-09-01T00:00:00Z' : '2026-11-01T00:00:00Z', entriesCount: 0, entries: [], rules: [], prizes: [] } } })
    }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
  })
  await page.goto('/staff')
  const expectFilterAtRight = async panelName => {
    const panel = page.getByRole('tabpanel', { name: `${panelName} content` })
    const panelBounds = await panel.boundingBox()
    const filterBounds = await panel.getByRole('button', { name: /^Filters/ }).boundingBox()
    const headingBounds = await panel.getByRole('heading', { name: panelName === 'Moderation' ? 'Reports' : 'Competitions', exact: true }).boundingBox()
    expect(headingBounds.x + headingBounds.width).toBeLessThan(filterBounds.x)
    expect(panelBounds.x + panelBounds.width - filterBounds.x - filterBounds.width).toBeLessThanOrEqual(2)
  }
  const selectStatus = async label => {
    await page.getByRole('button', { name: /^Filters/ }).click()
    const filterDialog = page.getByRole('dialog', { name: 'Filter by status' })
    await filterDialog.getByRole('button', { name: label, exact: true }).click()
    await filterDialog.getByRole('button', { name: 'Close filters' }).click()
  }
  await expectFilterAtRight('Moderation')
  await expect(page.getByText('A reported story')).toBeVisible()
  await expect(page.getByLabel('Review note')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review report' }).click()
  const review = page.getByRole('dialog', { name: 'Review report' })
  await review.getByLabel('Review note').fill('Needs a closer look.')
  await review.getByRole('button', { name: 'Begin review' }).click()
  await expect.poll(() => reviewPayload).toEqual({ action: 'begin_review', note: 'Needs a closer look.' })
  await expect(review).toHaveCount(0)
  await selectStatus('Reviewing')
  await expect(page.getByText('A reported comment')).toBeVisible()
  await selectStatus('Dismissed')
  await expect(page.getByText('A dismissed report')).toBeVisible()
  await page.getByRole('button', { name: 'View report' }).click()
  await expect(page.getByRole('dialog', { name: 'Review report' }).getByLabel('Review note')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close review report' }).click()
  await page.getByRole('tab', { name: 'Competitions' }).click()
  await expectFilterAtRight('Competitions')
  await expect(page.getByText('Current challenge')).toBeVisible()
  await expect(page.getByText('Finished challenge')).toHaveCount(0)
  await selectStatus('Past')
  await expect(page.getByText('Finished challenge')).toBeVisible()
  await expect(page.getByText('Current challenge')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add competition' }).click()
  await expect(page.getByRole('dialog', { name: 'Create competition' })).toBeVisible()
  await page.getByRole('button', { name: 'Close create competition' }).click()
  await page.getByRole('button', { name: 'View results' }).click()
  await expect(page).toHaveURL(/\/staff\/competitions\/past-one\/judging$/)
  await expect(page.getByRole('heading', { name: 'Finished challenge' })).toBeVisible()
  await page.goto('/staff')
  await page.getByRole('tab', { name: 'Competitions' }).click()
  await selectStatus('Past')
  await page.getByRole('link', { name: 'View Finished challenge competition' }).click()
  await expect(page).toHaveURL(/\/explore\/competitions\/past-one$/)
  await expect(page.getByRole('heading', { name: 'Finished challenge' })).toBeVisible()
  await page.goto('/staff')
  await page.getByRole('tab', { name: 'Competitions' }).click()
  await page.getByRole('link', { name: 'View Current challenge competition' }).click()
  await expect(page).toHaveURL(/\/explore\/competitions\/open-one$/)
  await expect(page.getByRole('heading', { name: 'Current challenge' })).toBeVisible()
})
