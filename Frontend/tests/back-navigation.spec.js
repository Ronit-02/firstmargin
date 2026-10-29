import { test, expect } from './support/ui-test.js'

const postId = '507f1f77bcf86cd799439012'
const post = { id: postId, title: 'A story about memory', excerpt: 'Read and remember.', tags: ['science'], author: { username: 'Maya Sen', handle: 'maya-sen' }, createdAt: '2026-09-08T00:00:00Z', readTime: '2 mins' }

async function mockApi(page, { member = true } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(member ? { json: { accessToken: 'back-test', user: 'Reader', email: 'reader@example.test', role: 'admin' } } : { status: 401, json: { message: 'Signed out' } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: [post], writers: [], shorts: [] } } })
    if (path === '/api/post/feed' || path === '/api/post/shorts') return route.fulfill({ json: { data: [post], meta: { nextCursor: null } } })
    if (path === `/api/post/${postId}`) return route.fulfill({ json: { postData: { ...post, _id: postId, body: JSON.stringify([{ id: 'text', type: 'text', content: post.excerpt }]) } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    if (path === '/api/v1/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: ['science', 'travel', 'design'].map(slug => ({ slug, displayName: slug })), suggestedWriters: [], selectedTopicSlugs: ['science', 'travel', 'design'], followedWriterIds: [] } } })
    if (path === '/api/auth/login') return route.fulfill({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email' } })
    if (path.endsWith('/comments') || path === '/api/v1/events') return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    return route.fulfill({ status: 500, json: { message: 'Test route unavailable' } })
  })
}

const detailRoutes = ['/search?q=memory', `/post/${postId}`, '/author/maya-sen', '/collections/missing', '/shorts/series/missing', '/history', '/membership', '/explore/questions/missing', '/explore/competitions/missing', '/opportunities']
const primaryRoutes = ['/', '/explore/trending', '/explore/questions', '/explore/competitions', '/author', '/collections', '/saved', '/shorts', '/members', '/notifications', '/staff', '/studio', '/profile', '/settings', '/help', '/unknown-page']

for (const width of [320, 1280]) {
  test(`Back and Forward restore the main scroll position at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 600 })
    await page.goto('/search?q=memory')
    await page.addStyleTag({ content: '#main-content > :last-child { min-height: 2400px; }' })
    const main = page.locator('#main-content')
    await main.evaluate(element => { element.scrollTop = 640 })
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(640)

    // Isolate route restoration from Playwright scrolling an offscreen link into view.
    await page.getByRole('link', { name: "View Maya Sen's profile" }).evaluate(link => link.click())
    await expect(page).toHaveURL('/author/maya-sen')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
    await main.evaluate(element => { element.scrollTop = 320 })

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL('/search?q=memory')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(640)

    await page.goForward()
    await expect(page).toHaveURL('/author/maya-sen')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(320)
  })

  test(`only detail and drill-down pages have a consistent Back control at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    for (const path of detailRoutes) {
      await page.goto(path)
      const back = page.getByRole('button', { name: 'Back', exact: true })
      await expect(back, path).toHaveCount(1)
      await expect(back, path).toBeVisible()
      await expect(page).not.toHaveURL(/\/login/)
      expect((await back.boundingBox()).height, path).toBeGreaterThanOrEqual(44)
      await expect(back).toHaveCSS('font-size', '13px')
      await expect(back).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(back).toHaveCSS('border-top-width', '0px')
      await expect(back).toHaveAttribute('type', 'button')
    }
    for (const path of primaryRoutes) {
      await page.goto(path)
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back', exact: true }), path).toHaveCount(0)
    }
    await page.goto('/settings')
    await page.screenshot({ path: `test-results/back-${width}.png` })
  })

  test(`Back restores search while primary destinations never show Back at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    const searchPath = '/search?q=memory&topic=science&sort=latest'
    await page.goto(searchPath)
    await page.getByRole('link', { name: "View Maya Sen's profile" }).click()
    await expect(page).toHaveURL('/author/maya-sen')
    const back = page.getByRole('button', { name: 'Back', exact: true })
    await back.focus()
    await back.press('Enter')
    await expect(page).toHaveURL(searchPath)
    await page.getByRole('link', { name: 'firstmargin home', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(back).toHaveCount(0)
    if (width < 768) await page.getByRole('link', { name: 'Explore', exact: true }).click()
    else await page.getByRole('navigation', { name: 'Desktop primary navigation' }).getByRole('link', { name: 'Trending', exact: true }).click()
    await expect(page).toHaveURL('/explore/trending')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(back).toHaveCount(0)
  })
}

for (const [path, parent] of [[`/post/${postId}`, '/'], ['/author/maya-sen', '/'], ['/explore/questions/missing', '/explore/questions'], ['/explore/competitions/missing', '/explore/competitions'], ['/collections/missing', '/collections'], ['/shorts/series/missing', '/shorts'], ['/opportunities', '/profile']]) {
  test(`direct entry ${path} falls back to ${parent}`, async ({ page }) => {
    await mockApi(page)
    await page.goto(path)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(parent)
    if (parent === '/') await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  })
}

test('auth retains the home link and verification omits Back', async ({ page }) => {
  await mockApi(page, { member: false })
  await page.setViewportSize({ width: 320, height: 560 })
  for (const path of ['/login', '/signup']) {
    await page.goto(path)
    const back = page.getByRole('button', { name: 'Back', exact: true })
    await expect(page.getByRole('heading', { name: path === '/login' ? 'Welcome Back' : 'Create Account' })).toBeVisible()
    await expect(back).toHaveCount(0)
    await page.getByRole('link', { name: 'Return to firstmargin home' }).click()
    await expect(page).toHaveURL('/')
  }
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('fixture-value')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enter Verification Code' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Verify Email', exact: true })).toBeVisible()
})

test('onboarding has only its previous-step Back control', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: 'Pick your interests' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next →', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Find your first writers' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to previous step' }).click()
  await expect(page.getByRole('heading', { name: 'Pick your interests' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
})

test('Back is available in dark mode and article loading states', async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await page.route(`**/api/post/${postId}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    await route.fulfill({ status: 404, json: { message: 'Missing' } })
  })
  await page.setViewportSize({ width: 320, height: 560 })
  await page.goto(`/post/${postId}`)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/back-dark.png' })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL('/')
})
