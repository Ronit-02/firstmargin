import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const id = '507f1f77bcf86cd799439012'
const author = { id, _id: id, username: 'Maya Sen', handle: 'maya-sen', picture: null }
const post = { id, _id: id, title: 'A story about memory', excerpt: 'Read and remember.', body: JSON.stringify([{ id: 'text', type: 'text', content: 'Take time to read and reflect.' }]), tags: ['science'], author, createdAt: '2026-09-08T00:00:00Z', readTime: '2 min read', likesCount: 0, commentsCount: 0 }
const question = { id, text: 'How do cities preserve memory?', context: 'Looking for a practical explanation.', tags: ['science'], upvotesCount: 12, followersCount: 4, answersCount: 0, responsePostsCount: 0, status: 'open', createdAt: post.createdAt, author, answers: [], responsePosts: [] }
const competition = { id, title: 'Writing about place', description: 'A community competition.', status: 'open', closeDate: '2026-11-01T00:00:00Z', votingMode: 'readers', entriesCount: 1, entries: [{ id, post, author, votesCount: 2 }] }
const collection = { id, title: 'Cities worth reading slowly', description: 'A collection about cities and memory.', visibility: 'public', postsCount: 1, savedCount: 2, author, posts: [post], isOwner: false }
const series = { id, title: 'Learning about cities', description: 'A short learning series.', visibility: 'public', entriesCount: 1, author, entries: [post], isOwner: false }
const writer = { id, handle: 'maya-sen', displayName: 'Maya Sen', bio: 'Writing about cities and memory.', joinedAt: post.createdAt, followersCount: 2, followingCount: 1, postsCount: 1, posts: [post], isSelf: false, isFollowing: false }
const surfaces = [
  ['home', '/', 'Ideas, stories, and answers from curious people.'],
  ['trending', '/explore/trending', 'Trending now'],
  ['questions', '/explore/questions', 'How do cities preserve memory?'],
  ['competitions', '/explore/competitions', 'Writing about place'],
  ['question', `/explore/questions/${id}`, question.text],
  ['competition', `/explore/competitions/${id}`, competition.title],
  ['search', '/search?q=memory', 'Search results'],
  ['search-writers', '/search?q=memory&type=writers', 'Search results'],
  ['search-shorts', '/search?q=memory&type=shorts', 'Search results'],
  ['search-questions', '/search?q=memory&type=questions', 'Search results'],
  ['post', `/post/${id}`, post.title], ['author', '/author/maya-sen', writer.displayName],
  ['collections', '/collections', collection.title], ['collection', `/collections/${id}`, collection.title],
  ['saved', '/saved', 'Library'], ['writing', '/studio', 'Studio'], ['shorts', '/shorts', 'Shorts'],
  ['series-index', '/series', 'Series'], ['series', `/shorts/series/${id}`, series.title], ['series-new-detail', `/series/${id}`, series.title], ['history', '/history', 'Reading history'],
  ['opportunities', '/opportunities', 'Answer what readers are asking for'],
  ['members', '/members', 'Closer to the creative process'],
  ['membership', '/membership', 'Go deeper with the writers you love'],
  ['profile', '/profile', writer.displayName], ['profile-edit', '/profile/edit', 'Edit profile'],
  ['settings', '/settings', null], ['help', '/help', null], ['staff', '/staff', 'Staff console'],
]

async function mockApi(page, { guest = false, failure, hold = false } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const p = url.pathname
    if (p === '/api/auth/refresh-token') return route.fulfill(guest ? { status: 401, json: { message: 'Signed out' } } : { json: { accessToken: 'alignment-fixture', user: 'Maya Sen', email: 'reader@example.test', role: 'admin' } })
    if (p === '/api/auth/login') return route.fulfill({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify email' } })
    const details = [`/api/post/${id}`, '/api/writer/maya-sen', `/api/question/${id}`, `/api/competition/${id}`, `/api/collection/${id}`, `/api/short-series/${id}`, '/api/series', '/api/v1/reading-history', '/api/search']
    if (details.includes(p)) {
      if (hold) return
      if (failure) return route.fulfill({ status: failure, json: { message: 'Unavailable' } })
    }
    let data = []
    if (p === `/api/post/${id}`) return route.fulfill({ json: { postData: post } })
    if (p === '/api/post/feed') data = [post, { ...post, id: '507f1f77bcf86cd799439013', title: 'Another memory' }]
    if (p === '/api/search') data = { posts: [post], writers: [writer], shorts: [{ ...post, format: 'short' }], questions: [question] }
    if (p === '/api/writer/maya-sen') data = writer
    if (p === '/api/question' || p === '/api/question/opportunities') data = [{ ...question, fitScore: 80, reason: 'Your interests', isClaimedByYou: false }]
    if (p === `/api/question/${id}`) data = question
    if (p === '/api/competition') data = [competition]
    if (p === `/api/competition/${id}`) data = competition
    if (p === '/api/collection') data = [collection]
    if (p === `/api/collection/${id}`) data = collection
    if (p === '/api/short-series') data = [series]
    if (p === '/api/series') data = [series]
    if (p === `/api/short-series/${id}`) data = series
    if (p === '/api/v1/reading-history') data = { continueReading: [], history: [{ ...post, progress: 50, lastReadAt: post.createdAt }] }
    if (p === '/api/v1/onboarding') data = { topics: ['science', 'travel', 'design'].map(slug => ({ slug, displayName: slug })), suggestedWriters: [writer], selectedTopicSlugs: ['science', 'travel', 'design'], followedWriterIds: [] }
    if (p === '/api/v1/me/entitlements') data = { capabilities: [], membership: { plan: 'free', status: 'inactive' } }
    if (p === '/api/v1/me/interests') data = { topicSlugs: [], topics: [] }
    if (p === '/api/user/me') data = { ...writer, role: 'admin', writerStatus: 'reader', postCount: 1 }
    if (p === '/api/user/me/posts') data = [post]
    if (p === '/api/user/bookmarks') return route.fulfill({ json: [post] })
    if (p === '/api/post/shorts') data = [{ ...post, format: 'short' }]
    return route.fulfill({ json: { data, meta: { unreadCount: 0, nextCursor: null }, topics: [] } })
  })
}

async function geometry(page) {
  return page.locator('[data-page-frame]').evaluate(frame => {
    const r = frame.getBoundingClientRect()
    const s = getComputedStyle(frame)
    const scroll = document.querySelector('[data-app-scroll]')
    const b = scroll.getBoundingClientRect()
    const back = document.querySelector('[data-page-back]')
    return { left: r.left + parseFloat(s.paddingLeft), right: r.right - parseFloat(s.paddingRight), width: r.width, frameLeft: r.left, gutter: parseFloat(s.paddingLeft), scrollLeft: b.left, availableWidth: scroll.clientWidth, backLeft: back ? back.getBoundingClientRect().left + parseFloat(getComputedStyle(back).paddingLeft) : null, overflow: scroll.scrollWidth > scroll.clientWidth, documentOverflow: document.documentElement.scrollWidth > innerWidth }
  })
}

async function assertFrame(page, name, width) {
  const g = await geometry(page)
  const gutter = width >= 768 ? 32 : width >= 640 ? 20 : 16
  expect(g.gutter, name).toBe(gutter)
  expect(g.width, name).toBe(Math.min(1120, g.availableWidth))
  expect(Math.abs(g.frameLeft - (g.scrollLeft + (g.availableWidth - g.width) / 2)), name).toBeLessThanOrEqual(1)
  expect(g.overflow, name).toBe(false)
  expect(g.documentOverflow, name).toBe(false)
  if (g.backLeft !== null) expect(Math.abs(g.backLeft - g.left), name).toBeLessThanOrEqual(1)
  return g
}

for (const width of [320, 768, 1280, 1920]) for (const theme of ['light', 'dark']) {
  test(`every application page shares the frame at ${width}px ${theme}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApi(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = path.resolve('node_modules/.cache/page-alignment', `${width}-${theme}`)
    await fs.mkdir(output, { recursive: true })
    const measurements = []
    let homeLeft
    for (const [name, url, heading] of surfaces) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-page-frame]')).toBeVisible()
      if (['saved', 'shorts'].includes(name)) await expect(page.getByRole('heading', { name: post.title, exact: true }).first()).toBeVisible()
      if (heading) await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      await expect(page.getByRole('main')).toHaveCount(1)
      await page.evaluate(() => document.fonts.ready)
      const g = await assertFrame(page, name, width)
      homeLeft ??= g.left
      expect(Math.abs(g.left - homeLeft), name).toBeLessThanOrEqual(1)
      // Include controls and content below the fold, which can create hidden horizontal overflow.
      const innerOverflow = await page.getByRole('main').evaluate(main => main.scrollWidth > main.clientWidth)
      expect(innerOverflow, name).toBe(false)
      measurements.push({ name, ...g })
      await page.screenshot({ path: path.join(output, `${name}.png`) })
    }
    await fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2))
    expect(errors).toEqual([])
  })
}

for (const state of ['loading', 'missing', 'error']) {
  test(`loading and recovery retain the shared origin: ${state}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockApi(page, { hold: state === 'loading', failure: state === 'missing' ? 404 : state === 'error' ? 500 : undefined })
    for (const [name, url] of surfaces.filter(([name]) => ['post', 'author', 'question', 'competition', 'collection', 'series', 'history', 'search'].includes(name))) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-page-frame]')).toBeVisible()
      await expect(page.getByRole(state === 'loading' ? 'status' : 'alert').first()).toBeVisible()
      await assertFrame(page, `${name} ${state}`, 1280)
    }
  })
}

test('page origins do not move when scrolling becomes necessary or the sidebar resizes', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.goto('/search')
  const before = await geometry(page)
  const resize = page.getByRole('separator', { name: 'Resize sidebar' })
  await resize.press('End')
  const resized = await assertFrame(page, 'expanded sidebar', 1920)
  await page.goto('/')
  expect((await geometry(page)).left).toBe(resized.left)
  await page.goto('/search')
  await page.locator('main').evaluate(main => { main.style.minHeight = '2000px' })
  expect((await geometry(page)).left).toBe(resized.left)
  expect(resized.scrollLeft).toBeGreaterThan(before.scrollLeft)
  await page.goto('/?feed=latest')
  const home = await geometry(page)
  await page.goto('/search?q=memory')
  expect((await geometry(page)).left).toBe(home.left)
})

for (const width of [320, 1280]) {
  test(`centered auth, guest, notification and recovery surfaces at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 800 })
    await mockApi(page, { guest: true })
    const output = path.resolve('node_modules/.cache/page-alignment', `${width}-other`)
    await fs.mkdir(output, { recursive: true })
    for (const url of ['/saved', '/history', '/opportunities', '/members', '/profile', '/notifications', '/staff', '/onboarding', '/studio?draft=private', '/author', '/unknown-page', '/login', '/signup']) {
      await page.goto(url)
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('main')).toBeVisible()
      expect(await page.getByRole('main').evaluate(main => main.scrollWidth > main.clientWidth), url).toBe(false)
      const prompt = page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true })
      if (await prompt.count()) {
        const b = await prompt.boundingBox()
        const scroll = await page.locator('[data-app-scroll]').count() ? await page.locator('[data-app-scroll]').boundingBox() : { x: 0, width }
        expect(Math.abs(b.x + b.width / 2 - scroll.x - scroll.width / 2), url).toBeLessThan(3)
      }
      await page.screenshot({ path: path.join(output, `${url.replace(/\W/g, '_') || 'home'}.png`) })
    }
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill('reader@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fixture-value')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Enter Verification Code' })).toBeVisible()
    await page.screenshot({ path: path.join(output, 'verification.png') })
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockApi(page)
    await page.goto('/notifications')
    await expect(page.getByRole('dialog', { name: 'Inbox', exact: true })).toBeVisible()
    await assertFrame(page, 'notification background', width)
    await page.screenshot({ path: path.join(output, 'notifications.png') })
    await page.keyboard.press('Escape')
    await page.goto('/onboarding')
    for (let step = 1; step <= 3; step++) {
      await expect(page.getByRole('button', { name: step === 3 ? 'Get Started' : 'Next →', exact: true })).toBeVisible()
      expect(await page.getByRole('main').evaluate(main => main.scrollWidth > main.clientWidth)).toBe(false)
      await page.screenshot({ path: path.join(output, `onboarding-${step}.png`) })
      if (step < 3) await page.getByRole('button', { name: 'Next →', exact: true }).click()
    }
  })
}

test('route inventory requires an explicit alignment audit for new pages', async () => {
  const app = await fs.readFile(path.resolve('src/App.jsx'), 'utf8')
  const routes = [...new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]))].sort()
  expect(routes).toEqual(['/', '/login', '/signup', '/onboarding', '/explore', 'trending', 'questions', 'competitions', '/explore/competitions/:id', '/explore/questions/:id', '/opportunities', '/search', '/post/:id', '/author', '/author/:handle', '/collections', '/saved', '/collections/:id', '/shorts', '/series', '/series/:id', '/shorts/series/:id', '/history', '/members', '/notifications', '/membership', '/staff', '/write', '/writing', '/studio', '/profile', '/profile/edit', '/settings', '/help', '*'].sort())
})

for (const width of [320, 605, 1280]) {
  test(`page-header actions align with headings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockApi(page)
    for (const [url, actionName] of [
      ['/collections', 'Create collection'],
      ['/series', 'Create a series'],
      ['/shorts', 'Browse series'],
      ['/explore/questions', 'Ask a question'],
      ['/studio', 'Write a post'],
    ]) {
      await page.goto(url)
      const action = page.getByRole(actionName === 'Browse series' ? 'link' : 'button', { name: actionName, exact: true })
      await expect(action).toBeVisible()
      const alignment = await action.evaluate(node => {
        const actionWrap = node.closest('header')?.lastElementChild
        const header = node.closest('header')
        const titleWrap = header?.firstElementChild
        const rect = element => element.getBoundingClientRect()
        return { header: rect(header), title: rect(titleWrap), action: rect(actionWrap) }
      })
      expect(alignment.action.x).toBeGreaterThanOrEqual(alignment.title.x + alignment.title.width - 1)
      expect(Math.abs(alignment.action.y + alignment.action.height / 2 - (alignment.title.y + alignment.title.height / 2))).toBeLessThanOrEqual(1)
      expect(alignment.action.x + alignment.action.width).toBeLessThanOrEqual(alignment.header.x + alignment.header.width + 1)
    }
  })
}

for (const width of [320, 1280]) {
  test(`secondary page panels retain their frame at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    await mockApi(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = path.resolve('node_modules/.cache/page-alignment', `${width}-panels`)
    await fs.mkdir(output, { recursive: true })
    for (const [url, role, labels] of [
      ['/staff', 'tab', ['Competitions']],
      ['/studio', 'tab', ['Analytics', 'Published', 'Drafts', 'Ideas', 'Updates', 'Workshops', 'Requests']],
      ['/saved', 'tab', ['Collections', 'History']],
      ['/members', 'tab', ['Early access', 'Creator extras', 'Workshops']],
    ]) {
      await page.goto(url)
      await expect(page.locator('[data-page-frame]')).toBeVisible()
      for (const label of labels) {
        await page.getByRole(role, { name: label, exact: true }).click()
        await assertFrame(page, `${url} ${label}`, width)
        await expect.poll(async () => page.getByRole('main').evaluate(main => main.scrollWidth > main.clientWidth)).toBe(false)
        await page.screenshot({ path: path.join(output, `${url.slice(1)}-${label.replaceAll(' ', '-')}.png`) })
      }
    }
    expect(errors).toEqual([])
  })
}
