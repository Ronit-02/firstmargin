import { test, expect } from '@playwright/test'

test('Member Hub links creator extras and workshop organizers by profile handle', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'member-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: ['behind_scenes', 'workshops'], membership: { status: 'active' } } } })
    if (path === '/api/v1/creator-updates') return route.fulfill({ json: { data: [{ _id: 'extra-1', title: 'Writing notes', body: 'A note.', creatorId: { username: 'Jane Writer', handle: 'jane-ink', picture: null } }] } })
    if (path === '/api/v1/workshops') return route.fulfill({ json: { data: [{ _id: 'workshop-1', title: 'Making a scene', description: 'A guided session.', startsAt: '2026-11-01T10:00:00Z', hostId: { username: 'Jane Writer', handle: 'jane-ink' } }] } })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/members?memberTab=updates')
  await expect(page.getByRole('link', { name: "View Jane Writer's profile" })).toHaveAttribute('href', '/author/jane-ink')
  await page.getByRole('button', { name: 'Read Writing notes' }).click()
  await expect(page.getByRole('link', { name: 'Jane Writer' })).toHaveAttribute('href', '/author/jane-ink')
  await page.getByRole('button', { name: 'Close creator extra' }).click()
  await page.getByRole('tab', { name: 'Workshops' }).click()
  await expect(page.getByText('Organized by')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Jane Writer' })).toHaveAttribute('href', '/author/jane-ink')
})

for (const width of [320, 1280]) {
  test(`workshop reservation delivers its link through the inbox at ${width}px`, async ({ page }) => {
    const meetingUrl = 'https://meet.example.test/workshop'
    let reservations = 0
    let readAttempts = 0
    let notices = []
    let registered = false
    await page.setViewportSize({ width, height: 800 })
    await page.route(meetingUrl, route => route.fulfill({ contentType: 'text/html', body: '<h1>Workshop meeting</h1>' }))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'workshop-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: ['workshops'], membership: { status: 'active' } } } })
      if (path === '/api/v1/workshops') return route.fulfill({ json: { data: [{ _id: 'workshop-1', title: 'Making a scene', description: 'A guided writing session.', startsAt: '2026-11-01T10:00:00Z', isRegistered: registered }] } })
      if (path === '/api/v1/workshops/workshop-1/registration') {
        expect(route.request().method()).toBe('PUT')
        reservations++
        await new Promise(resolve => setTimeout(resolve, 200))
        if (reservations === 1) return route.fulfill({ status: 500, json: { message: 'Please retry your reservation.' } })
        registered = true
        notices = [{ _id: 'notice-1', type: 'workshop_registered', title: 'Workshop place reserved', body: 'Your place in Making a scene is reserved. Open this notification to join the workshop.', href: meetingUrl, readAt: null, createdAt: '2026-10-20T12:00:00Z' }]
        return route.fulfill({ json: { data: { id: 'attendance-1', status: 'registered', meetingUrl } } })
      }
      if (path === '/api/v1/notifications') return route.fulfill({ json: { data: notices, meta: { unreadCount: notices.filter(item => !item.readAt).length, nextCursor: null } } })
      if (path === '/api/v1/notifications/notice-1/read') {
        readAttempts++
        if (readAttempts === 1) return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
        notices[0].readAt = '2026-10-20T12:01:00Z'
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
    })

    await page.goto('/members?memberTab=workshops')
    const reserve = page.getByRole('button', { name: 'Reserve a place', exact: true })
    await reserve.click()
    await expect(reserve).toBeDisabled()
    await expect(page.getByText('Please retry your reservation.')).toBeVisible()
    await expect(page.getByText('Place reserved. The workshop link will be sent to your notifications.')).toHaveCount(0)
    await reserve.click()
    await expect(page.getByText('Place reserved. The workshop link will be sent to your notifications.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Place reserved', exact: true })).toBeDisabled()
    await expect(reserve).toHaveCount(0)
    await page.getByRole('tab', { name: 'Early access' }).click()
    await page.getByRole('tab', { name: 'Workshops' }).click()
    await expect(page.getByRole('button', { name: 'Place reserved', exact: true })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Place reserved', exact: true })).toBeDisabled()
    await expect(reserve).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open workshop' })).toHaveCount(0)
    await expect(page.locator(`a[href="${meetingUrl}"]`)).toHaveCount(0)
    await page.getByRole('link', { name: '1 unread notifications' }).click()
    const inbox = page.getByRole('dialog', { name: 'Inbox', exact: true })
    const joiningLink = inbox.getByRole('link', { name: /Workshop place reserved/ })
    await expect(joiningLink).toHaveAttribute('href', meetingUrl)
    await joiningLink.click()
    await expect(page.getByText('The notification could not be marked as read.')).toBeVisible()
    await expect(inbox).toBeVisible()
    await joiningLink.click()
    await expect(page).toHaveURL(meetingUrl)
    await expect(page.getByRole('heading', { name: 'Workshop meeting' })).toBeVisible()
    expect(reservations).toBe(2)
    expect(readAttempts).toBe(2)
  })
}
