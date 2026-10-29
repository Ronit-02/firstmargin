import { test, expect } from './support/ui-test.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const id = '507f1f77bcf86cd799439012'
const author = { id, _id: id, username: 'Maya Sen', handle: 'maya-sen', picture: null }
const post = { id, _id: id, title: 'A story about memory', excerpt: 'Read and remember.', body: JSON.stringify([{ id: 'text', type: 'text', content: 'Take time to read and reflect.' }]), tags: ['science'], author, createdAt: '2026-09-08T00:00:00Z', readTime: '2 min read', likesCount: 0, commentsCount: 0 }
const surfaces = [
  ['post', `/post/${id}`, post.title], ['author', '/author/maya-sen', 'Maya Sen'],
  ['question', `/explore/questions/${id}`, 'How do cities preserve memory?'],
  ['competition', `/explore/competitions/${id}`, 'Writing about place'],
  ['collection', `/collections/${id}`, 'Cities worth reading slowly'],
  ['series', `/shorts/series/${id}`, 'Learning about cities'],
  ['search', '/search?q=memory', null], ['history', '/history', 'Reading history'],
  ['membership', '/membership', 'Go deeper with the writers you love'],
  ['login', '/login', null], ['signup', '/signup', null],
  ['verification', '/login', 'Enter Verification Code'], ['onboarding', '/onboarding', 'Find your first writers'],
]

async function mockApi(page, name, state = 'loaded') {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/auth/refresh-token') return route.fulfill(['login', 'signup', 'verification'].includes(name)
      ? { status: 401, json: { message: 'Signed out' } }
      : { json: { accessToken: 'back-layout-fixture', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (pathname === '/api/auth/login') return route.fulfill({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email' } })
    if ([`/api/post/${id}`, `/api/writer/maya-sen`, `/api/question/${id}`, `/api/competition/${id}`, `/api/collection/${id}`, `/api/short-series/${id}`].includes(pathname)) {
      if (state === 'loading') await new Promise(resolve => setTimeout(resolve, 5000))
      if (state === 'missing') return route.fulfill({ status: 404, json: { message: 'Missing' } })
      if (state === 'error') return route.fulfill({ status: 500, json: { message: 'Failed' } })
    }
    if (pathname === `/api/post/${id}`) return route.fulfill({ json: { postData: post } })
    if (pathname === '/api/writer/maya-sen') return route.fulfill({ json: { data: { id, handle: 'maya-sen', displayName: 'Maya Sen', bio: 'Writing about cities and memory.', joinedAt: '2026-09-08T00:00:00Z', followersCount: 2, followingCount: 1, postsCount: 1, posts: [post], isSelf: false, isFollowing: false } } })
    if (pathname === `/api/question/${id}`) return route.fulfill({ json: { data: { id, text: 'How do cities preserve memory?', context: 'Looking for a practical explanation.', tags: ['science'], upvotesCount: 12, followersCount: 4, status: 'open', createdAt: post.createdAt, author, answers: [], responsePosts: [] } } })
    if (pathname === `/api/competition/${id}`) return route.fulfill({ json: { data: { id, title: 'Writing about place', description: 'A community competition.', status: 'open', closeDate: '2026-11-01T00:00:00Z', votingMode: 'readers', entriesCount: 0, entries: [] } } })
    if (pathname === `/api/collection/${id}`) return route.fulfill({ json: { data: { id, title: 'Cities worth reading slowly', description: 'A collection about cities and memory.', visibility: 'public', postsCount: 1, savedCount: 2, followersCount: 1, author, posts: [post], isOwner: false } } })
    if (pathname === `/api/short-series/${id}`) return route.fulfill({ json: { data: { id, title: 'Learning about cities', description: 'A short learning series.', visibility: 'public', entriesCount: 1, author, entries: [post], isOwner: false } } })
    if (pathname === '/api/search') return route.fulfill({ json: { data: { posts: [post], writers: [], shorts: [] } } })
    if (pathname === '/api/v1/reading-history') return route.fulfill({ json: { data: { continueReading: [], history: [{ ...post, progress: 50, lastReadAt: post.createdAt }] } } })
    if (pathname === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: ['science', 'travel', 'design'].map(slug => ({ slug, displayName: slug })), suggestedWriters: [], selectedTopicSlugs: ['science', 'travel', 'design'], followedWriterIds: [] } } })
    if (pathname === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [], membership: { plan: 'free', status: 'inactive' } } } })
    if (pathname === '/api/v1/me/interests') return route.fulfill({ json: { data: { topicSlugs: [], topics: [] } } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
}

async function openSurface(page, name, url, heading) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (name === 'verification') {
    await page.getByLabel('Email', { exact: true }).fill('reader@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fixture-value')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
  }
  if (name === 'onboarding') await page.getByRole('button', { name: 'Next →', exact: true }).click()
  if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  else await expect(page.getByRole('main')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function inspectBack(page) {
  return page.getByRole('button', { name: /^(Back|Back to previous step)$/ }).evaluate(button => {
    const b = button.getBoundingClientRect()
    const style = getComputedStyle(button)
    const points = [[b.left + 3, b.top + b.height / 2], [b.right - 3, b.top + b.height / 2], [b.left + b.width / 2, b.top + b.height / 2], [b.left + b.width / 2, b.bottom - 3], [b.left + b.width / 2, b.top + 3]]
    const covered = points.some(([x, y]) => !button.contains(document.elementFromPoint(x, y)))
    const row = button.closest('[data-page-back]')
    const sibling = row?.nextElementSibling
    const main = sibling?.matches('main') ? sibling : sibling?.querySelector('main')
    const first = main?.firstElementChild
    const next = first?.getBoundingClientRect()
    return { back: b.toJSON(), covered, radius: style.borderRadius, background: style.backgroundColor, gap: next ? next.top - b.bottom : null, nextLeft: next?.left, outline: style.outlineStyle, shadow: style.boxShadow, overflow: document.documentElement.scrollWidth > innerWidth }
  })
}

for (const width of [320, 1280]) for (const theme of ['light', 'dark']) {
  test(`Back stays pinned while scrolling at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 560 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await mockApi(page, 'post')
    await page.route(`**/api/post/${id}`, route => route.fulfill({ json: { postData: {
      ...post,
      body: JSON.stringify(Array.from({ length: 40 }, (_, index) => ({ id: `paragraph-${index}`, type: 'text', content: 'Take time to read and reflect on the stories that shape our cities and communities.' }))),
    } } }))
    await openSurface(page, 'post', `/post/${id}`, post.title)
    const back = page.getByRole('button', { name: 'Back', exact: true })
    const initial = await back.boundingBox()
    const scroll = page.locator('[data-app-scroll]')
    for (const top of [400, 1200, 2400]) {
      await scroll.evaluate((element, value) => element.scrollTo({ top: value, behavior: 'instant' }), top)
      await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      const result = await inspectBack(page)
      expect(result.covered).toBe(false)
      expect(result.back.y).toBe(initial.y)
      expect(result.back.x).toBe(initial.x)
      expect(result.overflow).toBe(false)
    }
    await expect(page.locator('[data-page-back]')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 27)' : 'rgb(255, 255, 255)')
    await back.focus()
    await expect(back).toBeFocused()
    expect((await inspectBack(page)).covered).toBe(false)
    await page.screenshot({ path: `node_modules/.cache/back-layout-audit/sticky-${width}-${theme}.png` })
    await back.press('Enter')
    await expect(page).toHaveURL('/')
    await expect(back).toHaveCount(0)
  })
}

// Static geometry needs one theme per width; sticky Back above checks both backgrounds.
for (const width of [320, 1280]) {
  const theme = width < 768 ? 'light' : 'dark'
  test(`Back layout on every surface at ${width}px in ${theme}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    const output = path.resolve('node_modules/.cache/back-layout-audit', process.env.BACK_AUDIT_PHASE || 'after', `${width}-${theme}`)
    await fs.mkdir(output, { recursive: true })
    const measurements = []
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const [name, url, heading] of surfaces) {
      await mockApi(page, name)
      await openSurface(page, name, url, heading)
      const back = page.getByRole('button', { name: /^(Back|Back to previous step)$/ })
      if (['login', 'signup', 'verification'].includes(name)) {
        await expect(back).toHaveCount(0)
        if (name !== 'verification') await expect(page.getByRole('link', { name: 'Return to firstmargin home' })).toBeVisible()
        else await expect(page.getByRole('heading', { name: 'Enter Verification Code' })).toBeVisible()
        await page.screenshot({ path: path.join(output, `${name}.png`) })
        continue
      }
      await expect(back).toHaveCount(1)
      await back.scrollIntoViewIfNeeded()
      const result = await inspectBack(page)
      measurements.push({ name, ...result })
      expect(result.covered, name).toBe(false)
      expect(result.overflow, name).toBe(false)
      expect(result.back.height, name).toBeGreaterThanOrEqual(44)
      if (process.env.BACK_AUDIT_PHASE !== 'before' && result.gap !== null) {
        expect(result.gap, name).toBeGreaterThanOrEqual(16)
        expect(Math.abs(result.back.x + 8 - result.nextLeft), name).toBeLessThanOrEqual(1)
      }
      await page.keyboard.press('Tab')
      await back.focus()
      await expect(back).toBeFocused()
      if (process.env.BACK_AUDIT_PHASE !== 'before') {
        const focused = await inspectBack(page)
        expect(focused.outline, name).toBe('none')
        expect(focused.shadow, name).not.toBe('none')
      }
      await back.evaluate(button => button.blur())
      await page.screenshot({ path: path.join(output, `${name}.png`) })
    }
    await fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2))
    expect(errors).toEqual([])
  })
}

for (const state of ['loading', 'missing', 'error']) {
  test(`Back stays separate from ${state} detail content`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 320, height: 560 })
    for (const [name, url] of surfaces.slice(0, 6)) {
      await mockApi(page, name, state)
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      if (state === 'missing') {
        const recovery = page.getByRole('alert')
        await expect(recovery).toBeVisible()
        await expect(recovery.getByRole('link')).toBeVisible()
        continue
      }
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
      if (state === 'loading') await expect(page.getByRole('status').first()).toBeVisible()
      else await expect(page.getByRole('alert').first()).toBeVisible()
      const result = await inspectBack(page)
      expect(result.covered, `${name} ${state}`).toBe(false)
      expect(result.gap, `${name} ${state}`).toBeGreaterThanOrEqual(16)
    }
  })
}

test('final onboarding step keeps Back clear of Skip and Get Started', async ({ page }) => {
  for (const width of [320, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockApi(page, 'onboarding')
    await openSurface(page, 'onboarding', '/onboarding', 'Find your first writers')
    await page.getByRole('button', { name: 'Next →', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Discover features' })).toBeVisible()
    const back = page.getByRole('button', { name: 'Back to previous step' })
    await back.scrollIntoViewIfNeeded()
    expect((await inspectBack(page)).covered).toBe(false)
    const b = await back.boundingBox()
    const skip = await page.getByRole('button', { name: 'Skip', exact: true }).boundingBox()
    expect(b.x + b.width).toBeLessThanOrEqual(skip.x)
    const output = path.resolve('node_modules/.cache/back-layout-audit/after', `${width}-${theme}`)
    await fs.mkdir(output, { recursive: true })
    await page.screenshot({ path: path.join(output, 'onboarding-final.png') })
    await back.click()
    await expect(page.getByRole('heading', { name: 'Find your first writers' })).toBeVisible()
  }
})

test('Back remains reachable on short forms and aligned through responsive breakpoints', async ({ page }) => {
  test.setTimeout(180_000)
  for (const width of [390, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 700 })
    for (const [name, url, heading] of surfaces.slice(0, 9)) {
      await mockApi(page, name)
      await openSurface(page, name, url, heading)
      const result = await inspectBack(page)
      expect(result.covered, `${name} ${width}`).toBe(false)
      expect(result.gap, `${name} ${width}`).toBeGreaterThanOrEqual(16)
      expect(Math.abs(result.back.x + 8 - result.nextLeft), `${name} ${width}`).toBeLessThanOrEqual(1)
    }
  }
  await page.setViewportSize({ width: 320, height: 360 })
  for (const [name, url, heading] of surfaces.slice(9)) {
    await mockApi(page, name)
    await openSurface(page, name, url, heading)
    const back = page.getByRole('button', { name: /^(Back|Back to previous step)$/ })
    if (name !== 'onboarding') {
      await expect(back).toHaveCount(0)
      if (name !== 'verification') {
        await page.getByRole('link', { name: 'Return to firstmargin home' }).click()
        await expect(page).toHaveURL('/')
      }
      continue
    }
    await back.scrollIntoViewIfNeeded()
    expect((await inspectBack(page)).covered, name).toBe(false)
    await back.click()
    if (name === 'onboarding') await expect(page.getByRole('heading', { name: 'Pick your interests' })).toBeVisible()
    else await expect(page).toHaveURL('/')
  }
})
