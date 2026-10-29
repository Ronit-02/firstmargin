import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from '@playwright/test'

const pageErrors = new WeakMap()
test.beforeEach(({ page }) => {
  const errors = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]))

async function mockAuth(page, { signedIn = false, failLogin = false } = {}) {
  let authenticated = signedIn
  const privateReads = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(authenticated
      ? { json: { accessToken: 'auth-modal-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } }
      : { status: 401, json: { message: 'Signed out' } })
    if (path === '/api/auth/login' || path === '/api/auth/google') {
      if (failLogin) { failLogin = false; return route.fulfill({ status: 401, json: { message: 'Unable to sign in.' } }) }
      authenticated = true
      return route.fulfill({ json: { token: 'auth-modal-test', username: 'Reader', email: 'reader@example.test', role: 'regular' } })
    }
    if (path.startsWith('/api/user') || path.startsWith('/api/v1/') && !path.startsWith('/api/v1/events') || path.startsWith('/api/drafts')) privateReads.push(path)
    if (path === '/api/user/bookmarks') return route.fulfill({ json: [] })
    if (path === '/api/v1/reading-history') return route.fulfill({ json: { data: { continueReading: [], history: [] } } })
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: [], writers: [], selectedTopicSlugs: [], followedWriterIds: [] } } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  return privateReads
}

async function signIn(page) {
  const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
  await expectModalHeader(dialog)
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
  await dialog.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
  await dialog.getByRole('button', { name: 'Login', exact: true }).click()
}

test('standalone authentication tabs follow routes and browser history', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/login')
  const tabs = page.getByRole('tablist', { name: 'Authentication mode' })
  await tabs.getByRole('tab', { name: 'Sign Up' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await expect(tabs.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')
  await page.reload()
  await expect(tabs.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(tabs.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true')
  await page.goForward()
  await expect(tabs.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')
})

for (const width of [768, 1280]) {
  test(`navbar Sign In opens the login page and returns after login at ${width}px`, async ({ page }) => {
    await mockAuth(page)
    await page.setViewportSize({ width, height: 800 })
    const origin = '/collections?collectionSort=popular#reading'
    await page.goto(origin)
    const navbar = page.getByRole('navigation', { name: 'Global navigation' })
    await navbar.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page).toHaveURL(origin)
    await expect(navbar.getByRole('button', { name: 'Open account menu' })).toBeVisible()
  })
}

const guestPages = [
  ['/profile', 'Sign in to view your profile.'],
  ['/members', 'Sign in to access members page.'],
  ['/onboarding', 'Sign in to personalize your experience.'],
  ['/opportunities', 'Sign in to view your writing opportunities.'],
  ['/saved', 'Sign in to view your saved stories.'],
  ['/history', 'Sign in to view your reading history.'],
  ['/notifications', 'Sign in to view your notifications.'],
  ['/staff', 'Sign in to access the staff console.'],
]

for (const width of [320, 1280]) {
  for (const [path, message] of guestPages) {
    test(`guest access to ${path} waits for Sign In at ${width}px`, async ({ page }) => {
      const reads = await mockAuth(page)
      await page.setViewportSize({ width, height: 568 })
      await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'dark' : 'light')
      const url = `${path}?access=test#return`
      await page.goto(url)
      const prompt = page.getByRole('region', { name: 'Sign in required' })
      await expect(prompt.getByText(message, { exact: true })).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page).toHaveURL(url)
      expect(reads).toEqual([])
      const centered = await prompt.evaluate(element => {
        const text = element.querySelector('p').getBoundingClientRect()
        const button = element.querySelector('button').getBoundingClientRect()
        const container = document.getElementById('main-content')
        const bounds = container ? container.getBoundingClientRect() : { x: 0, y: 0, width: innerWidth, height: innerHeight }
        const padding = container ? parseFloat(getComputedStyle(container).paddingBottom) : 0
        return {
          x: (button.x + button.width / 2) - (bounds.x + bounds.width / 2),
          y: (text.y + button.bottom) / 2 - (bounds.y + (bounds.height - padding) / 2),
          overflow: document.documentElement.scrollWidth > innerWidth,
        }
      })
      expect(Math.abs(centered.x)).toBeLessThanOrEqual(2)
      expect(Math.abs(centered.y)).toBeLessThanOrEqual(2)
      expect(centered.overflow).toBe(false)
      if (path === '/members' || path === '/profile') await page.screenshot({ path: `node_modules/.cache/auth-access/prompt-${path.slice(1)}-${width}.png` })
      const trigger = prompt.getByRole('button', { name: 'Sign In', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
      await expectModalHeader(dialog)
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Close sign-in dialog' }).click()
      await expect(trigger).toBeFocused()
      await expect(page).toHaveURL(url)
      expect(reads).toEqual([])
    })
  }
}

for (const width of [320, 1280]) {
  test(`private guard retains URL, blocks reads, dismisses and signs in at ${width}px`, async ({ page }) => {
    const reads = await mockAuth(page)
    await page.setViewportSize({ width, height: 568 })
    await page.goto('/saved?view=collections#library')
    await page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
    await expectModalHeader(dialog)
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/saved\?view=collections#library$/)
    expect(reads).toEqual([])
    expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true)
    const bounds = await dialog.locator('section').boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(bounds.height).toBeLessThanOrEqual(568 - 32)
    await page.screenshot({ path: `node_modules/.cache/auth-access/auth-access-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true }).click()
    await signIn(page)
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/saved\?view=collections#library$/)
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  })
}

for (const signup of [false, true]) {
  test(`${signup ? 'new signup onboards' : 'existing account verification returns'} from the modal`, async ({ page }) => {
    await mockAuth(page)
    await page.route('**/api/auth/login', route => route.fulfill({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email.' } }))
    await page.route('**/api/auth/verify-email', route => route.fulfill({ json: { token: 'verified-test', username: 'Reader', email: 'reader@example.test', role: 'regular' } }))
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/saved?view=collections#library')
    await page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expectModalHeader(dialog)
    if (signup) {
      await dialog.getByRole('tab', { name: 'Sign Up' }).click()
      await expect(dialog).toHaveAccessibleName('Join firstmargin')
      await expect(dialog.getByRole('button', { name: 'Close sign-up dialog' })).toBeVisible()
      await expect(dialog.getByText('Create Account', { exact: true })).toHaveCount(0)
      await expect(dialog.locator('label[for="auth-name"]')).toBeVisible()
      await dialog.getByRole('textbox', { name: 'Full Name' }).fill('Reader')
      await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
      await dialog.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
      await dialog.getByRole('textbox', { name: 'Confirm Password' }).fill('test-password-123')
      await dialog.getByRole('button', { name: 'Sign Up', exact: true }).click()
    } else await signIn(page)
    await expect(dialog.getByRole('heading', { name: 'Enter Verification Code' })).toBeVisible()
    for (let digit = 1; digit <= 6; digit++) await dialog.getByRole('textbox', { name: `Verification digit ${digit}` }).fill(String(digit))
    await dialog.getByRole('button', { name: 'Verify Email' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(signup ? /\/onboarding$/ : /\/saved\?view=collections#library$/)
  })
}

test('guest action keeps its page and filters through failed login and retry', async ({ page }) => {
  await mockAuth(page, { failLogin: true })
  await page.goto('/collections?collectionSort=popular#reading')
  const trigger = page.getByRole('button', { name: 'Create collection' })
  await trigger.click()
  await signIn(page)
  const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
  await expectModalHeader(dialog)
  await expect(dialog.getByRole('alert')).toHaveText('Unable to sign in.')
  await expect(dialog.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('reader@example.test')
  await dialog.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/collections\?collectionSort=popular#reading$/)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Create a collection' })).toBeVisible()
})

test('profile prompt opens a modal and Close restores its trigger', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/profile?tab=history#account')
  const trigger = page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
  await expectModalHeader(dialog)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await dialog.getByRole('button', { name: 'Close sign-in dialog' }).click()
  await expect(trigger).toBeFocused()
  await expect(page).toHaveURL(/\/profile\?tab=history#account$/)
})

test('Google sign-in returns to the guarded page', async ({ page }) => {
  await mockAuth(page)
  await page.addInitScript(() => {
    window.google = { accounts: { id: {
      initialize(options) { this.callback = options.callback },
      renderButton(container) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Continue with Google'
        button.onclick = () => this.callback({ credential: 'mock-google-credential' })
        container.appendChild(button)
      },
    } } }
  })
  await page.goto('/history?sort=recent#progress')
  await page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  const google = page.getByRole('button', { name: 'Continue with Google' })
  if (await google.count() === 0) { test.skip(true, 'Google client ID is not configured'); return }
  await google.click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/history\?sort=recent#progress$/)
})

test('failed session refresh opens one sign-in modal without navigating away', async ({ page }) => {
  let refreshes = 0
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(++refreshes === 1
      ? { json: { accessToken: 'expired-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } }
      : { status: 401, json: { message: 'Session expired' } })
    if (path === '/api/v1/reading-history') return route.fulfill({ status: 401, json: { message: 'Session expired' } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  await page.goto('/history?sort=recent#progress')
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toHaveCount(1)
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).toHaveURL(/\/history\?sort=recent#progress$/)
  await page.getByRole('button', { name: 'Close sign-in dialog' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('expiring access token refreshes once before parallel API reads', async ({ page }) => {
  const expiringToken = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 5 })).toString('base64url')}.signature`
  const freshToken = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
  let refreshes = 0
  const authorization = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: {
      accessToken: ++refreshes === 1 ? expiringToken : freshToken,
      user: 'Reader', email: 'reader@example.test', role: 'regular',
    } })
    if (['/api/v1/notifications', '/api/post/shorts', '/api/post/feed'].includes(path)) {
      authorization.push(route.request().headers().authorization)
    }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  await page.goto('/help')
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible()
  await page.evaluate(async () => {
    const { default: api } = await import('/src/app/api.js')
    await Promise.all([
      api.get('/api/v1/notifications'),
      api.get('/api/post/shorts'),
      api.get('/api/post/feed'),
    ])
  })
  expect(refreshes).toBe(2)
  expect(authorization.length).toBeGreaterThanOrEqual(3)
  expect(authorization.every(value => value === `Bearer ${freshToken}`)).toBe(true)
})

  test('account sign-in opens the modal and retains its full originating URL', async ({ page }) => {
    await mockAuth(page)
    const url = '/shorts?shortSort=popular#reading'
    await page.setViewportSize({ width: 390, height: 735 })
    await page.goto(url)
      await page.getByRole('button', { name: 'Account', exact: true }).click()
      await page.getByRole('dialog', { name: 'Account', exact: true }).getByRole('button', { name: 'Sign In', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Account', exact: true })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
    await expect(page).toHaveURL(url)
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page).toHaveURL(url)
  })
