import { test, expect } from './support/ui-test.js'

const writers = Array.from({ length: 10 }, (_, index) => ({ id: `writer-${index}`, handle: `writer-${index}`, displayName: `Writer ${index + 1}`, bio: 'Stories about everyday curiosity.', followersCount: 100 - index }))
const posts = Array.from({ length: 12 }, (_, index) => ({ id: `story-${index}`, title: `Story ${index + 1}`, excerpt: 'A story about everyday curiosity.', author: { id: 'writer-0', username: 'Writer 1', handle: 'writer-0' }, tags: [], likesCount: 2, commentsCount: 0, createdAt: '2026-10-01T10:00:00Z' }))

async function mockWriters(page, { fail = false, empty = false } = {}) {
  const searches = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/post/feed') return route.fulfill({ json: { data: posts, meta: { nextCursor: null } } })
    if (url.pathname === '/api/search') {
      searches.push(Object.fromEntries(url.searchParams))
      if (fail) { fail = false; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
      const query = (url.searchParams.get('q') || '').trim()
      return route.fulfill({ json: { data: { writers: empty ? [] : query ? writers.slice(0, 1) : writers, posts: [], shorts: [], questions: [] } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return searches
}

for (const width of [320, 1280]) {
  test(`Find writers opens the top ten authors in Writers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const searches = await mockWriters(page)
    await page.goto('/')
    await page.locator('.stream-line').last().scrollIntoViewIfNeeded()
    await page.locator('[data-app-scroll]').evaluate(node => { node.scrollTop = node.scrollHeight })
    const find = page.getByRole('link', { name: 'Find writers' })
    await expect(find).toHaveAttribute('href', '/search?type=writers')
    await find.click()
    await expect(page).toHaveURL(/\/search\?type=writers$/)
    await expect(page.getByRole('tab', { name: 'Writers', exact: true })).toHaveAttribute('aria-selected', 'true')
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByText('Top authors', { exact: true })).toBeVisible()
    await expect(panel.getByRole('article')).toHaveCount(10)
    await expect(panel.getByRole('link', { name: 'View profile', exact: true }).first()).toHaveAttribute('href', '/author/writer-0')
    await expect(panel.getByText('What are you curious about?')).toHaveCount(0)
    expect(searches.every(search => search.q === '' && search.type === 'writers')).toBe(true)
    await page.reload()
    await expect(panel.getByRole('article')).toHaveCount(10)
    await page.getByRole('tab', { name: 'Stories', exact: true }).click()
    await expect(panel.getByText('Popular stories', { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('tab', { name: 'Writers', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('article')).toHaveCount(10)
    await page.goto('/search?type=writers&q=maya')
    await expect(panel.getByText('Showing 1 writer')).toBeVisible()
    await expect(panel.getByRole('article')).toHaveCount(1)
    await expect(panel.getByText('Top authors', { exact: true })).toHaveCount(0)
  })
}

test('empty Writers browsing retains retry and empty states', async ({ page }) => {
  await mockWriters(page, { fail: true, empty: true })
  await page.goto('/search?type=writers')
  await expect(page.getByRole('alert')).toContainText('Search is unavailable')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'No writers found' })).toBeVisible()
  await expect(page.getByText('What are you curious about?')).toHaveCount(0)
})
