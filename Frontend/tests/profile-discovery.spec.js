import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from '@playwright/test'

const memberEmail = process.env.E2E_MEMBER_EMAIL || 'member@inkrider.local'
const password = process.env.E2E_PASSWORD || 'InkRiderDemo123!'

const writer = {
  id: '507f1f77bcf86cd799439011',
  handle: 'maya-sen',
  displayName: 'Maya Sen',
  bio: 'Essays on cities, memory, and public life.',
  avatarUrl: null,
  websiteUrl: null,
  writerStatus: 'writer',
  membershipEnabled: true,
  directRequestsEnabled: true,
  followersCount: 42,
  followingCount: 8,
  joinedAt: '2025-01-15T00:00:00.000Z',
  isFollowing: false,
  isSelf: false,
  posts: [],
}

const mockMemberProfileApi = async page => {
  let hasSession = false
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({
        status: hasSession ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(hasSession
          ? { accessToken: 'profile-test-token', user: 'Priya Mehta', email: memberEmail, role: 'regular' }
          : { message: 'Signed out' }),
      })
    }
    if (url.pathname === '/api/auth/login' && request.method() === 'POST') {
      hasSession = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'profile-test-token', username: 'Priya Mehta', email: memberEmail, role: 'regular' }),
      })
    }
    if (url.pathname === '/api/writer/maya-sen') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: writer }) })
    }
    if (url.pathname === '/api/v1/me/entitlements') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: ['direct_creator_requests'] } }) })
    }
    if (url.pathname === '/api/v1/notifications') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    }

    return route.abort('blockedbyclient')
  })
}

test.describe('public writer profile discovery', () => {
  test('writer follow updates authenticated state and rolls back a failed unfollow', async ({ page }) => {
    const methods = []
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'follow-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
      if (path === '/api/writer/maya-sen') return route.fulfill({ json: { data: writer } })
      if (path === `/api/writer/${writer.id}/follow`) {
        const method = route.request().method()
        methods.push(method)
        return route.fulfill({ status: methods.length === 2 ? 500 : 200, json: methods.length === 2 ? { message: 'Unavailable' } : { isFollowing: method === 'PUT', followersCount: method === 'PUT' ? 43 : 42 } })
      }
      return route.fulfill({ json: { data: { capabilities: [] }, meta: { unreadCount: 0 } } })
    })
    await page.goto('/author/maya-sen')
    const follow = page.getByRole('button', { name: 'Follow', exact: true })
    const following = page.getByRole('button', { name: 'Following', exact: true })
    await follow.click()
    await expect(following).toBeEnabled()
    await expect(page.getByText('43 followers', { exact: true })).toBeVisible()
    await following.click()
    await expect(page.locator('main').getByRole('alert')).toContainText("We couldn't update your follow.")
    await expect(following).toBeEnabled()
    await expect(page.getByText('43 followers', { exact: true })).toBeVisible()
    await following.click()
    await expect(follow).toBeEnabled()
    await expect(page.getByText('42 followers', { exact: true })).toBeVisible()
    expect(methods).toEqual(['PUT', 'DELETE', 'DELETE'])
  })

  test('writer loading exposes a named status region on phone', async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
      }
      if (url.pathname === '/api/writer/maya-sen') {
        await new Promise(resolve => setTimeout(resolve, 600))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { username: 'Maya Sen', posts: [] } }) })
      }
      return route.abort('blockedbyclient')
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/author/maya-sen', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status', { name: 'Loading writer profile' })).toBeVisible()
  })

  test('writer recovery navigates through a real search link', async ({ page }) => {
    await page.goto('/author', { waitUntil: 'domcontentloaded' })

    const searchWritersLink = page.getByRole('link', { name: 'Search writers' })
    await expect(searchWritersLink).toHaveAttribute('href', '/search?type=writers')
    await searchWritersLink.click()

    await expect(page).toHaveURL(/\/search\?type=writers$/)
    await expect(page.getByRole('tab', { name: 'Writers' })).toHaveAttribute('aria-selected', 'true')
  })

  test('member direct-request form has visible labels and fits a phone viewport', async ({ page }) => {
    await mockMemberProfileApi(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill(memberEmail)
    await page.getByLabel('Password').fill(password)
    const [loginResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/auth/login')),
      page.locator('form button[type="submit"]').click(),
    ])
    expect(loginResponse.status()).toBe(200)
    await page.waitForURL('**/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    await page.goto('/author/maya-sen', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Maya Sen', level: 1 })).toBeVisible()
    await expect(page.locator('main')).toHaveCount(1)

    const requestButton = page.getByRole('button', { name: 'Request an article' })
    await requestButton.click()
    await expect(requestButton).toHaveAttribute('aria-expanded', 'true')
    const dialog = page.getByRole('dialog', { name: 'Direct request to Maya Sen' })
    await expectModalHeader(dialog)
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(node => node.matches(':modal'))).toBe(true)

    const subject = page.getByLabel('Request subject')
    const details = page.getByLabel('Request details')
    await expect(subject).toBeVisible()
    await expect(details).toBeVisible()
    await expect(subject).toHaveAttribute('aria-describedby', /creator-request-subject-help/)
    await expect(details).toHaveAttribute('aria-describedby', /creator-request-details-help/)

    await subject.fill('A labelled request')
    await details.fill('Useful context for the writer.')
    await expect(page.getByText('18/140', { exact: true })).toBeVisible()
    await expect(page.getByText('30/2000', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send request' })).toBeEnabled()

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ))
    expect(hasHorizontalOverflow).toBe(false)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(requestButton).toBeFocused()
    await requestButton.click()
    await expect(page.getByLabel('Request subject')).toHaveValue('A labelled request')
    await expect(page.getByLabel('Request details')).toHaveValue('Useful context for the writer.')
  })

  for (const width of [320, 1280]) {
    for (const access of ['member', 'free', 'expired']) {
      test(`article request modal handles ${access} access at ${width}px`, async ({ page }, testInfo) => {
        let submissions = 0
        await page.route(url => url.pathname.startsWith('/api/'), route => {
          const path = new URL(route.request().url()).pathname
          if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'request-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
          if (path === '/api/writer/maya-sen') return route.fulfill({ json: { data: writer } })
          if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: access === 'free' ? [] : ['direct_creator_requests'] } } })
          if (path === `/api/v1/creators/${writer.id}/requests`) {
            submissions++
            expect(route.request().postDataJSON()).toEqual({ subject: 'Article idea', details: 'Useful context' })
            return route.fulfill({ status: access === 'expired' ? 403 : submissions === 1 ? 500 : 201, json: access === 'expired' ? { code: 'ENTITLEMENT_REQUIRED', message: 'An active membership is required' } : submissions === 1 ? { message: 'Unavailable' } : { data: {}, remainingThisMonth: 2 } })
          }
          return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
        })
        await page.setViewportSize({ width, height: 600 })
        await page.goto('/author/maya-sen')
        const trigger = page.getByRole('button', { name: 'Request an article' })
        await trigger.click()
        const dialog = page.getByRole('dialog', { name: 'Direct request to Maya Sen' })
        await expectModalHeader(dialog)
        await expect(dialog).toBeVisible()
        expect(await dialog.evaluate(node => node.matches(':modal') && node.parentElement === document.body)).toBe(true)
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab')
          expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
        }
        if (access !== 'free') {
          await dialog.getByLabel('Request subject').fill('Article idea')
          await dialog.getByLabel('Request details').fill('Useful context')
          await dialog.getByRole('button', { name: 'Send request' }).click()
          await expect(dialog.getByRole('alert')).toBeVisible()
          if (access === 'member') {
            await expect(dialog.getByLabel('Request subject')).toHaveValue('Article idea')
            await dialog.getByRole('button', { name: 'Send request' }).click()
            await expect(dialog.getByRole('status')).toContainText('Request sent. You have 2 left this month.')
          }
        }
        if (access !== 'member') {
          await expect(dialog.getByRole('alert')).toHaveText('Direct creator requests are available to members.')
          const join = dialog.getByRole('link', { name: 'Become a member' })
          await expect(join).toHaveAttribute('href', '/membership')
          await dialog.screenshot({ path: testInfo.outputPath('membership-request.png') })
          await join.click()
          await expect(page).toHaveURL(/\/membership$/)
        } else {
          await dialog.getByRole('button', { name: 'Close article request' }).click()
          await expect(trigger).toBeFocused()
          await trigger.click()
          await expect(dialog.getByLabel('Request subject')).toHaveValue('')
          await page.keyboard.press('Escape')
          await expect(trigger).toBeFocused()
        }
        expect(submissions).toBe(access === 'free' ? 0 : access === 'expired' ? 1 : 2)
      })
    }
  }

  test('profile library tabs restore from a shareable URL state', async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname === '/api/auth/refresh-token') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ accessToken: 'profile-tab-token', user: 'Priya Mehta', email: memberEmail, role: 'regular' }),
        })
      }
      if (url.pathname === '/api/user/me') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
          displayName: 'Priya Mehta', handle: 'priya-mehta', bio: 'Reader', avatarUrl: null,
          joinedAt: '2025-01-15T00:00:00.000Z', writerStatus: 'reader', role: 'regular',
          postCount: 0, followersCount: 0, followingCount: 0,
        } }) })
      }
      if (url.pathname === '/api/user/me/posts') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      }
      if (url.pathname === '/api/v1/me/entitlements') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: [] } }) })
      }
      if (url.pathname === '/api/v1/notifications') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
      }
      if (url.pathname === '/api/v1/reading-history') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { continueReading: [], history: [] } }) })
      }
      if (url.pathname === '/api/user/bookmarks') return route.fulfill({ json: [] })
      if (url.pathname === '/api/collection') return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
      return route.abort('blockedbyclient')
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/profile?profileTab=history', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Recent history', level: 2 })).toBeVisible()
    await expect(page).toHaveURL(/\/saved\?libraryTab=history$/)
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'History content' })).toBeVisible()

    await page.getByRole('tab', { name: 'History' }).press('Home')
    await expect(page).toHaveURL(/\/saved$/)
    await expect(page.getByRole('tab', { name: 'Saved', exact: true })).toHaveAttribute('aria-selected', 'true')

  })

  test('profile published-post failures expose a retry state on phone', async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'profile-posts-token', user: 'Priya Mehta', email: memberEmail, role: 'regular' }) })
      }
      if (url.pathname === '/api/user/me') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { displayName: 'Priya Mehta', handle: 'priya-mehta', bio: 'Reader', avatarUrl: null, joinedAt: '2025-01-15T00:00:00.000Z', writerStatus: 'reader', role: 'regular', postCount: 0, followersCount: 0, followingCount: 0 } }) })
      }
      if (url.pathname === '/api/user/me/posts') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
      }
      if (url.pathname === '/api/v1/me/entitlements') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: [] } }) })
      }
      if (url.pathname === '/api/v1/notifications') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
      }
      if (url.pathname === '/api/v1/reading-history') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { continueReading: [], history: [] } }) })
      }
      return route.abort('blockedbyclient')
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/profile?profileTab=posts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('Published stories could not be loaded.')
    const retry = page.getByRole('button', { name: 'Try again' })
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(40)
  })

  test('profile draft failures expose a retry state on phone', async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'profile-drafts-token', user: 'Priya Mehta', email: memberEmail, role: 'regular' }) })
      }
      if (url.pathname === '/api/user/me') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { displayName: 'Priya Mehta', handle: 'priya-mehta', bio: 'Reader', avatarUrl: null, joinedAt: '2025-01-15T00:00:00.000Z', writerStatus: 'reader', role: 'regular', postCount: 0, followersCount: 0, followingCount: 0 } }) })
      }
      if (url.pathname === '/api/user/me/posts') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      }
      if (url.pathname === '/api/drafts') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
      }
      if (url.pathname === '/api/v1/me/entitlements') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: [] } }) })
      }
      if (url.pathname === '/api/v1/notifications') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
      }
      if (url.pathname === '/api/v1/reading-history') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { continueReading: [], history: [] } }) })
      }
      return route.abort('blockedbyclient')
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/profile?profileTab=drafts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('Drafts could not be loaded.')
    const retry = page.getByRole('button', { name: 'Try again' })
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(40)
  })

  test('profile draft loading exposes a named status region on phone', async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname === '/api/auth/refresh-token') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'profile-draft-loading-token', user: 'Priya Mehta', email: memberEmail, role: 'regular' }) })
      }
      if (url.pathname === '/api/user/me') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { displayName: 'Priya Mehta', handle: 'priya-mehta', bio: 'Reader', avatarUrl: null, joinedAt: '2025-01-15T00:00:00.000Z', writerStatus: 'reader', role: 'regular', postCount: 0, followersCount: 0, followingCount: 0 } }) })
      }
      if (url.pathname === '/api/user/me/posts') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      }
      if (url.pathname === '/api/drafts') {
        await new Promise(resolve => setTimeout(resolve, 600))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      }
      if (url.pathname === '/api/v1/me/entitlements') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: [] } }) })
      }
      if (url.pathname === '/api/v1/notifications') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
      }
      if (url.pathname === '/api/v1/reading-history') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { continueReading: [], history: [] } }) })
      }
      return route.abort('blockedbyclient')
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/profile?profileTab=drafts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status', { name: 'Loading drafts' })).toBeVisible()
  })
})
