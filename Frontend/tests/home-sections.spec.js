import { test, expect } from './support/ui-test.js'

const posts = Array.from({ length: 12 }, (_, index) => ({
  id: `507f1f77bcf86cd7994390${20 + index}`,
  title: `A seeded story ${index + 1}`,
  excerpt: 'A short excerpt for the Home deferred section regression.',
  body: 'A short body.',
  image: null,
  author: { id: `507f1f77bcf86cd7994391${20 + index}`, username: 'Maya Sen', handle: 'maya-sen', picture: null },
  tags: ['science'],
  readTime: '4 min read',
  createdAt: '2026-08-25T00:00:00.000Z',
  likesCount: 2,
  commentsCount: 0,
  isLiked: false,
  isBookmarked: false,
}))

test('Home deferred collections expose a retryable failure state', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    if (requestUrl.pathname === '/api/post/feed') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: posts, meta: { nextCursor: null } }) })
    if (requestUrl.pathname === '/api/post/shorts') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    if (requestUrl.pathname === '/api/collection') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('status', { name: 'Loading discovery section' }).last().scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Browse collections' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Collections could not be loaded.', { timeout: 10_000 })
  await expect(page.getByRole('alert').getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('Home replaces loading sections when the API server cannot be reached', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (new URL(route.request().url()).pathname === '/api/post/feed') return route.abort('connectionrefused')
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'firstmargin is temporarily unavailable.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('We can’t reach the server right now.')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Global navigation' })).toHaveCount(0)
})

test('Home carousels drag continuously without arrow controls and section headings have descriptions', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/feed') return route.fulfill({ json: { data: posts, meta: { nextCursor: null } } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    if (path === '/api/collection') return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.locator('.stream-line').nth(3).scrollIntoViewIfNeeded()
  await page.getByRole('heading', { name: "Writer's picks" }).scrollIntoViewIfNeeded()
  await expect(page.getByText('Discover a few stories from writers in your feed.')).toBeVisible()
  const writerAction = page.getByRole('link', { name: 'View trending' })
  const writerAlignment = await writerAction.evaluate(node => {
    const row = node.parentElement.parentElement
    const button = node.parentElement.getBoundingClientRect()
    const heading = row.firstElementChild.getBoundingClientRect()
    const outer = row.getBoundingClientRect()
    return { button, heading, outer }
  })
  expect(writerAlignment.button.y).toBeGreaterThanOrEqual(writerAlignment.heading.y + writerAlignment.heading.height)
  expect(writerAlignment.button.x + writerAlignment.button.width).toBeLessThanOrEqual(writerAlignment.outer.x + writerAlignment.outer.width + 1)
  const track = page.getByRole('region', { name: "Writer's picks stories" })
  await expect(track).toHaveCSS('scroll-snap-type', 'none')
  await expect(page.getByText('Swipe or drag ↔').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Scroll Writer's picks stories/ })).toHaveCount(0)
  const box = await track.boundingBox()
  const y = box.y + Math.min(box.height / 2, 90)
  await page.mouse.move(box.x + box.width * 0.8, y)
  await page.mouse.down()
  const positions = []
  for (let step = 1; step <= 5; step += 1) {
    await page.mouse.move(box.x + box.width * 0.8 - step * 25, y)
    positions.push(await track.evaluate(node => node.scrollLeft))
  }
  await page.mouse.up()
  expect(positions.every((value, index) => index === 0 || value > positions[index - 1])).toBe(true)
  expect(positions[4] - positions[0]).toBeGreaterThan(80)
  await page.locator('.stream-line').nth(7).scrollIntoViewIfNeeded()
  await expect(page.getByText('Follow a thread of curiosity through the latest writing.')).toBeVisible()
  await page.locator('.stream-line').nth(11).scrollIntoViewIfNeeded()
  await page.getByRole('heading', { name: 'Browse collections' }).scrollIntoViewIfNeeded()
  await expect(page.getByText('Explore stories gathered around shared themes.')).toBeVisible()
  await page.evaluate(() => document.querySelector('[data-app-scroll]')?.scrollBy(0, 700))
  await page.getByRole('heading', { name: 'Top authors' }).scrollIntoViewIfNeeded()
  await expect(page.getByText('Meet the writers behind the stories in your feed.')).toBeVisible()
})

test('covered Home carousel cards use the excerpt space above their actions', async ({ page }) => {
  const excerpt = 'A seeded discovery story gives readers another useful perspective to browse and rank. '.repeat(4)
  const cover = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180"%3E%3Crect width="320" height="180" fill="%238899aa"/%3E%3C/svg%3E'
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/feed') return route.fulfill({ json: { data: posts.map((post, index) => index === 0 ? { ...post, image: cover, excerpt } : post), meta: { nextCursor: null } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.locator('.stream-line').nth(3).scrollIntoViewIfNeeded()
  await page.getByRole('heading', { name: "Writer's picks" }).scrollIntoViewIfNeeded()
  const card = page.getByRole('region', { name: "Writer's picks stories" }).locator('[data-carousel-card]').first()
  const description = card.locator('p').filter({ hasText: 'A seeded discovery story' })
  await expect(description).toBeVisible()
  await expect.poll(() => description.evaluate(node => Number.parseInt(getComputedStyle(node).webkitLineClamp, 10))).toBeGreaterThanOrEqual(1)
  const layout = await card.evaluate(node => {
    const excerpt = [...node.querySelectorAll('p')].find(item => item.textContent.includes('A seeded discovery story'))
    const footer = excerpt.parentElement.parentElement.lastElementChild
    return { excerptBottom: Math.min(excerpt.getBoundingClientRect().bottom, excerpt.parentElement.getBoundingClientRect().bottom), footerTop: footer.getBoundingClientRect().top }
  })
  expect(layout.excerptBottom).toBeLessThan(layout.footerTop)
})
