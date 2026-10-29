import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from './support/ui-test.js'

const notice = (id, readAt = null) => ({ _id: id, title: `Update ${id}`, body: 'An answer is ready to read.', href: '/settings', readAt, createdAt: '2026-10-08T10:00:00Z' })

async function mockNotifications(page, options = {}) {
  let items = options.items || [notice('new'), notice('read', '2026-10-08T12:00:00Z')]
  let listFailure = options.listFailure || 0
  let markFailure = options.markFailure || 0
  let olderFailure = options.olderFailure || 0
  let deleteFailure = options.deleteFailure || 0
  const calls = { one: 0, all: 0, deleted: [], older: 0, recover: () => { listFailure = 0 } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(options.guest ? { status: 401, json: { message: 'Signed out' } } : { json: { accessToken: 'notification-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: [], writers: [], selectedTopicSlugs: [] } } })
    if (path === '/api/v1/notifications') {
      if (listFailure) { listFailure--; return route.fulfill({ status: options.outage ? 503 : 500, json: { message: 'Unavailable' } }) }
      if (url.searchParams.has('cursor')) {
        calls.older++
        if (olderFailure) { olderFailure--; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
        return route.fulfill({ json: { data: [notice('older', '2026-10-08T12:00:00Z')], meta: { unreadCount: 1, nextCursor: null } } })
      }
      return route.fulfill({ json: { data: items, meta: { unreadCount: items.filter(item => !item.readAt).length, nextCursor: options.paginated ? 'older-cursor' : null } } })
    }
    if (path.startsWith('/api/v1/notifications/')) {
      if (route.request().method() === 'DELETE') {
        if (deleteFailure) { deleteFailure--; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
        const id = path.split('/').at(-1)
        calls.deleted.push(id)
        items = items.filter(item => item._id !== id)
        return route.fulfill({ status: 204 })
      }
      if (path.endsWith('read-all')) calls.all++
      else calls.one++
      if (markFailure) { markFailure--; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
      items = items.map(item => path.endsWith('read-all') || path.includes(item._id) ? { ...item, readAt: '2026-10-09T00:00:00Z' } : item)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null }, topics: [], questions: [] } })
  })
  return calls
}

test('delete removes one notification after success and retries after failure', async ({ page }) => {
  const calls = await mockNotifications(page, { deleteFailure: 1 })
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  const remove = dialog.getByRole('button', { name: 'Delete notification: Update new' })
  await remove.click()
  await expect(page.getByText('The notification could not be deleted.')).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Update new/ })).toBeVisible()
  await remove.click()
  await expect(dialog.getByRole('link', { name: /Update new/ })).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: /Update read/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '0 unread notifications' })).toBeVisible()
  expect(calls.deleted).toEqual(['new'])
})

test('per-item read button updates only the selected notification', async ({ page }) => {
  const calls = await mockNotifications(page)
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  const mark = dialog.getByRole('button', { name: 'Mark notification as read: Update new' })
  const remove = dialog.getByRole('button', { name: 'Delete notification: Update new' })
  const markBounds = await mark.boundingBox()
  const removeBounds = await remove.boundingBox()
  expect(markBounds.x + markBounds.width).toBeLessThanOrEqual(removeBounds.x)
  await mark.click()
  await expect(dialog.getByRole('button', { name: 'Notification already read: Update new' })).toBeDisabled()
  await expect(dialog.getByRole('link', { name: /Update new/ })).toBeVisible()
  expect(calls.one).toBe(1)
})

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`notifications inbox fits, traps focus and scrolls at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 480 })
      await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
      await mockNotifications(page, { items: Array.from({ length: 20 }, (_, index) => ({ ...notice(`${index}`), title: 'A'.repeat(180), body: 'B'.repeat(500) })) })
      await page.goto('/notifications')
      const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
      await expect(dialog).toBeVisible()
      await expectModalHeader(dialog)
      await expect(dialog.getByRole('heading', { name: 'A'.repeat(180) })).toHaveCount(20)
      expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(width < 768)
      const bounds = await dialog.locator('section').evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, overflow: element.scrollWidth > element.clientWidth } })
      expect(bounds.x).toBeGreaterThanOrEqual(width < 768 ? 15 : 8)
      expect(bounds.y).toBeGreaterThanOrEqual(15)
      expect(bounds.right).toBeLessThanOrEqual(width - (width < 768 ? 15 : 8))
      expect(bounds.bottom).toBeLessThanOrEqual(width < 768 ? 465 : 472)
      expect(bounds.overflow).toBe(false)
      await expect(dialog.getByRole('button', { name: 'Close notifications' })).toBeFocused()
      for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true) }
      await page.keyboard.press('Shift+Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
      if (width < 768) {
        const trigger = await page.locator('#notification-trigger-mobile').boundingBox()
        expect(bounds.y).toBe(54)
        expect(bounds.y).toBeGreaterThanOrEqual(trigger.y + trigger.height)
        expect(bounds.right).toBe(width - 16)
        await page.locator('#main-content').evaluate(element => element.focus())
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
      } else {
        const trigger = await page.locator('#notification-trigger').boundingBox()
        expect(bounds.y).toBeCloseTo(trigger.y + trigger.height + 8, 0)
        expect(bounds.right).toBeCloseTo(trigger.x + trigger.width, 0)
      }
      const scroller = dialog.locator('section > div.overflow-y-auto')
      await scroller.evaluate(element => { element.scrollTop = 200 })
      expect(await scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await page.screenshot({ path: `node_modules/.cache/notifications-audit/${width}-${theme}.png` })
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(page).toHaveURL(/\/$/)
    })
  }
}

test('desktop popover preserves route, query and scroll and restores its opener', async ({ page }) => {
  await mockNotifications(page)
  await page.goto('/help?from=notifications#guide')
  const opener = page.getByRole('link', { name: '1 unread notifications' })
  await expect(opener).toBeVisible()
  await page.locator('#main-content').evaluate(element => { element.scrollTop = 160 })
  const before = await page.locator('#main-content').evaluate(element => element.scrollTop)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await expect(dialog).toBeVisible()
  await expectModalHeader(dialog)
  expect(await page.locator('#main-content').evaluate(element => element.scrollTop)).toBe(before)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/help\?from=notifications#guide$/)
  await expect(opener).toBeFocused()
  expect(await page.locator('#main-content').evaluate(element => element.scrollTop)).toBe(before)
  await opener.click()
  await dialog.getByRole('button', { name: 'Close notifications' }).click()
  await expect(opener).toBeFocused()
  await opener.click()
  await page.getByRole('heading', { name: 'Help', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('mobile navbar opens notifications and closing restores trigger focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await mockNotifications(page)
  await page.goto('/settings?from=mobile')
  const opener = page.getByRole('link', { name: '1 unread notifications' })
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(opener).toBeVisible()
  const search = page.getByRole('search')
  const searchBounds = await search.boundingBox()
  const openerBounds = await opener.boundingBox()
  expect(openerBounds.x).toBeGreaterThanOrEqual(searchBounds.x + searchBounds.width)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await expect(dialog).toBeVisible()
  await expectModalHeader(dialog)
  const inboxBounds = await dialog.locator('section').boundingBox()
  expect(inboxBounds.y).toBe(54)
  expect(inboxBounds.y).toBeGreaterThanOrEqual(openerBounds.y + openerBounds.height)
  expect(inboxBounds.x + inboxBounds.width).toBeCloseTo(openerBounds.x + openerBounds.width, 0)
  await page.screenshot({ path: 'node_modules/.cache/notifications-audit/mobile-inbox.png' })
  await dialog.getByRole('button', { name: 'Close notifications' }).click()
  await expect(page).toHaveURL(/\/settings\?from=mobile$/)
  await expect(opener).toBeFocused()
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Account', exact: true }).getByRole('link', { name: 'Notifications', exact: true })).toHaveCount(0)
})

test('notification trigger toggles the popover without adding a second inbox entry', async ({ page }) => {
  await mockNotifications(page)
  await page.goto('/help?from=toggle')
  const trigger = page.locator('#notification-trigger')
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Inbox', exact: true })).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Inbox', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/help\?from=toggle$/)
  await expect(trigger).toBeFocused()
})

test('open inbox adapts between anchored desktop and mobile modal', async ({ page }) => {
  await mockNotifications(page)
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await expect(dialog).toBeVisible()
  await expectModalHeader(dialog)
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(false)
  await page.setViewportSize({ width: 390, height: 640 })
  await expect(page.locator('dialog:modal')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close notifications' })).toBeFocused()
  await page.setViewportSize({ width: 1280, height: 640 })
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Close notifications' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('mark all failure retries and refreshes unread badge', async ({ page }) => {
  const calls = await mockNotifications(page, { markFailure: 1 })
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  const mark = dialog.getByRole('button', { name: 'Mark all read' })
  await expect(mark).toBeVisible()
  await page.screenshot({ path: 'node_modules/.cache/notifications-audit/desktop-inbox.png' })
  await mark.click()
  await expect(page.getByText('Notifications could not be marked as read.', { exact: true })).toBeVisible()
  await expect(mark).toBeEnabled()
  await mark.click()
  await expect(mark).toHaveCount(0)
  await expect(dialog.getByText('Unread ·', { exact: false })).toHaveCount(0)
  expect(calls.all).toBe(2)
  await dialog.getByRole('button', { name: 'Close notifications' }).click()
  await expect(page.getByRole('link', { name: '0 unread notifications' })).toBeVisible()
})

test('unread item failure retains modal, retry marks before destination, read item skips mutation', async ({ page }) => {
  const calls = await mockNotifications(page, { markFailure: 1 })
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await dialog.getByRole('link', { name: /Update new/ }).click()
  await expect(page.getByText('The notification could not be marked as read.', { exact: true })).toBeVisible()
  await expect(dialog).toBeVisible()
  await expectModalHeader(dialog)
  await dialog.getByRole('link', { name: /Update new/ }).click()
  await expect(page).toHaveURL(/\/settings$/)
  expect(calls.one).toBe(2)
  await page.goto('/notifications')
  await dialog.getByRole('link', { name: /Update read/ }).click()
  await expect(page).toHaveURL(/\/settings$/)
  expect(calls.one).toBe(2)
})

test('older notifications recover from pagination failure without losing first page', async ({ page }) => {
  const calls = await mockNotifications(page, { paginated: true, olderFailure: 1 })
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await expect(dialog.getByRole('alert')).toContainText('More items could not be loaded')
  await expect(dialog.getByRole('link', { name: /Update new/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(dialog.getByRole('link', { name: /Update older/ })).toBeVisible()
  expect(calls.older).toBe(2)
})

test('ordinary inbox load failure retries to empty state', async ({ page }) => {
  const calls = await mockNotifications(page, { items: [], listFailure: 10 })
  await page.goto('/notifications')
  const dialog = page.getByRole('dialog', { name: 'Inbox', exact: true })
  await expect(dialog.getByRole('alert')).toHaveText('Notifications could not be loaded.')
  calls.recover()
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(dialog.getByText('Comments, follows, appreciations, answers, request updates, and competition results will appear here.')).toBeVisible()
})

test('guest inbox retains sign-in gating without notification reads', async ({ page }) => {
  await mockNotifications(page, { guest: true })
  let reads = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/notifications') reads++ })
  await page.goto('/notifications')
  await expect(page.getByRole('dialog', { name: 'Inbox', exact: true })).toHaveCount(0)
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.getByText('Sign in to view your notifications.', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(reads).toBe(0)
})

test('service outage removes the modal and exposes global recovery', async ({ page }) => {
  await mockNotifications(page, { listFailure: 10, outage: true })
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'firstmargin is temporarily unavailable.' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Inbox', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
