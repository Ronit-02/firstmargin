import { test, expect } from '@playwright/test'

const posts = Array.from({ length: 20 }, (_, index) => ({
  id: `post-${index}`, title: `Loading story ${index}`, excerpt: 'A discovery fixture.',
  tags: [index % 2 ? 'travel' : 'science'], createdAt: '2026-01-01', likesCount: index,
  author: { username: 'Writer', handle: 'writer' }, format: 'article', readTime: '3 min read',
}))
const series = type => Array.from({ length: 16 }, (_, index) => ({
  id: `series-${type}-${index}`, title: `${type} series ${index}`, type,
  author: { username: 'Writer', handle: 'writer' }, entriesCount: 2,
  entriesPreview: [{ id: 'one', title: 'First part', position: 1 }, { id: 'two', title: 'Second part', position: 2 }],
}))

async function sampleScroll(page) {
  return page.evaluate(() => {
    window.filterScrollFrames = []
    window.stopFilterFrames = false
    const sample = () => {
      window.filterScrollFrames.push(document.getElementById('main-content').scrollTop)
      if (!window.stopFilterFrames) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return document.getElementById('main-content').scrollTop
  })
}

async function expectStableFrames(page, top) {
  const frames = await page.evaluate(() => { window.stopFilterFrames = true; return window.filterScrollFrames })
  expect(frames.length).toBeGreaterThan(10)
  expect(Math.min(...frames)).toBeGreaterThanOrEqual(top - 1)
  expect(Math.max(...frames)).toBeLessThanOrEqual(top + 1)
}

async function mockDelayedApi(page, shouldHold) {
  let release
  let pending = false
  let result = 'success'
  const gate = new Promise(resolve => { release = resolve })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const reply = json => route.fulfill({ json })
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
    if (shouldHold(url)) {
      pending = true
      await gate
      if (result === 'error') return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
      if (result === 'empty') return reply({ data: [], meta: { nextCursor: null } })
    }
    if (url.pathname === '/api/series') return reply({ data: series(url.searchParams.get('type')), meta: { nextCursor: null } })
    if (url.pathname === '/api/post/feed' || url.pathname === '/api/post/shorts') return reply({ data: posts.map(post => ({ ...post, format: url.pathname.endsWith('shorts') ? 'short' : 'article' })), meta: { nextCursor: null } })
    if (url.pathname === '/api/question') return reply({ data: posts.map(post => ({ ...post, text: post.title, responsePosts: [], answersCount: 0, upvotesCount: 1 })), meta: { nextCursor: null } })
    if (url.pathname === '/api/search') return reply({ data: { posts, shorts: [], writers: [], questions: [] } })
    if (url.pathname === '/api/collection') return reply({ data: series('article').map(item => ({ ...item, visibility: 'public', postsCount: 2 })), meta: { nextCursor: null } })
    return reply({ data: [], meta: { nextCursor: null, unreadCount: 0 } })
  })
  return { pending: () => pending, release: value => { result = value || 'success'; release() } }
}

for (const width of [390, 1280]) {
  for (const result of ['success', 'empty', 'error']) {
    test(`Series category has no intermediate scroll bounce for ${result} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 })
      const api = await mockDelayedApi(page, url => url.pathname === '/api/series' && url.searchParams.get('type') === 'short')
      await page.goto('/series')
      await expect(page.getByRole('link', { name: /^View series article series 0$/i })).toBeVisible()
      const main = page.locator('#main-content')
      await main.evaluate(element => { element.scrollTop = 180 })
      const shorts = page.getByRole('tab', { name: 'Shorts', exact: true })
      await shorts.scrollIntoViewIfNeeded()
      const top = await sampleScroll(page)
      expect(top).toBeGreaterThan(60)
      await shorts.click()
      await expect.poll(api.pending).toBe(true)
      await page.waitForFunction(() => window.filterScrollFrames.length >= 15)
      api.release(result)
      if (result === 'success') await expect(page.getByRole('link', { name: /^View series short series 0$/i })).toBeVisible()
      else if (result === 'empty') await expect(page.getByText('No short series yet.', { exact: true })).toBeVisible()
      else await expect(page.getByRole('alert')).toContainText('Series could not be loaded.')
      const count = await page.evaluate(() => window.filterScrollFrames.length)
      await page.waitForFunction(value => window.filterScrollFrames.length > value + 10, count)
      await expectStableFrames(page, top)
      await expect(shorts).toBeFocused()
      await main.evaluate(element => { element.scrollTop = 0 })
      await expect.poll(() => main.getAttribute('data-preserve-scroll')).toBe(null)
      await page.goBack()
      await expect(page.getByRole('tab', { name: 'Stories', exact: true })).toHaveAttribute('aria-selected', 'true')
      await page.goForward()
      await expect(shorts).toHaveAttribute('aria-selected', 'true')
    })
  }
}

for (const surface of [
  { path: '/explore/trending', api: '/api/post/feed', param: 'sort', value: 'latest', option: 'Latest' },
  { path: '/explore/questions', api: '/api/question', param: 'sort', value: 'newest', option: 'Newest' },
  { path: '/shorts', api: '/api/post/shorts', param: 'sort', value: 'popular', option: 'Most appreciated' },
  { path: '/collections', api: '/api/collection', param: 'sort', value: 'popular', option: 'Most saved' },
  { path: '/search?q=loading', api: '/api/search', param: 'sort', value: 'latest', option: 'Latest' },
]) {
  test(`${surface.path} retains its viewport throughout a delayed sort`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    const api = await mockDelayedApi(page, url => url.pathname === surface.api && url.searchParams.get(surface.param) === surface.value)
    await page.goto(surface.path)
    const main = page.locator('#main-content')
    await main.evaluate(element => { element.scrollTop = 40 })
    await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByRole('combobox', { name: 'Sort', exact: true }).click()
    const top = await sampleScroll(page)
    expect(top).toBeGreaterThan(0)
    await page.getByRole('option', { name: surface.option, exact: true }).click()
    await expect.poll(api.pending).toBe(true)
    await page.waitForFunction(() => window.filterScrollFrames.length >= 15)
    api.release()
    await page.waitForFunction(() => window.filterScrollFrames.length >= 40)
    await expectStableFrames(page, top)
  })
}
