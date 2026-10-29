import { test, expect } from './support/ui-test.js'

const authorId = '507f1f77bcf86cd799439011'
const series = (id, type, title) => ({ id, type, title, description: 'A reading path by this writer.', entriesCount: 2, createdAt: '2026-10-01T10:00:00Z', author: { id: authorId, username: 'Maya Sen', handle: 'maya' }, entriesPreview: [{ id: `${id}-1`, title: 'First chapter', position: 1 }, { id: `${id}-2`, title: 'Second chapter', position: 2 }] })

async function mockAuthor(page, { failure = false, empty = false, paginated = false } = {}) {
  const reads = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/writer/maya') return route.fulfill({ json: { data: { id: authorId, displayName: 'Maya Sen', handle: 'maya', bio: 'Writing about everyday curiosity.', posts: [], followersCount: 2, joinedAt: '2025-01-01', isSelf: false } } })
    if (url.pathname === '/api/series') {
      reads.push(Object.fromEntries(url.searchParams))
      if (failure) return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
      const short = url.searchParams.get('type') === 'short'
      const older = url.searchParams.has('cursor')
      await new Promise(resolve => setTimeout(resolve, 150))
      return route.fulfill({ json: { data: empty ? [] : [series(older ? 'older-story' : short ? 'short-path' : 'story-path', short ? 'short' : 'article', older ? 'Earlier story series' : short ? 'Small observations' : 'Everyday stories')], meta: { nextCursor: paginated && !short && !older ? 'older-page' : null } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return { reads, recover: () => { failure = false } }
}

for (const width of [320, 1280]) {
  test(`author Series category displays both formats and persists at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const { reads } = await mockAuthor(page)
    await page.goto('/author/maya?keep=yes#writing')
    const categories = page.getByRole('tablist', { name: 'Published writing categories' })
    await expect(categories.getByRole('tab')).toHaveText(['Stories', 'Shorts', 'Collections', 'Series'])
    expect(reads).toHaveLength(0)
    await categories.getByRole('tab', { name: 'Series', exact: true }).click()
    const panel = page.getByRole('tabpanel', { name: 'Series content' })
    await expect(panel.getByRole('link', { name: 'View series Everyday stories', exact: true })).toHaveAttribute('href', '/series/story-path')
    await expect(panel.getByRole('link', { name: 'View series Small observations', exact: true })).toHaveAttribute('href', '/series/short-path')
    expect(reads.every(read => read.authorId === authorId && !read.mine && !read.saved)).toBe(true)
    expect(new Set(reads.map(read => read.type))).toEqual(new Set(['article', 'short']))
    await expect(page).toHaveURL('/author/maya?keep=yes&authorFormat=series#writing')
    await expect(page.getByRole('button', { name: /Filters/ })).toHaveCount(0)
    await page.reload()
    await expect(categories.getByRole('tab', { name: 'Series', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('article')).toHaveCount(2)
    await categories.getByRole('tab', { name: 'Collections', exact: true }).click()
    await expect(page.getByText('No public collections yet.')).toBeVisible()
    await page.goBack()
    await expect(panel.getByRole('article')).toHaveCount(2)
    expect(await page.getByRole('main').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  })
}

test('author Series category loads additional author-scoped pages', async ({ page }) => {
  const { reads } = await mockAuthor(page, { paginated: true })
  await page.goto('/author/maya?authorFormat=series')
  await page.getByRole('tabpanel', { name: 'Series content' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('link', { name: 'View series Earlier story series', exact: true })).toBeVisible()
  expect(reads.some(read => read.authorId === authorId && read.type === 'article' && read.cursor === 'older-page')).toBe(true)
  await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(3)
})

test('author Series category retains profile identity through failure, retry and empty results', async ({ page }) => {
  const { recover } = await mockAuthor(page, { failure: true, empty: true })
  await page.goto('/author/maya?authorFormat=series')
  const panel = page.getByRole('tabpanel', { name: 'Series content' })
  await expect(panel.getByRole('alert')).toContainText('Series could not be loaded.', { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Maya Sen', exact: true })).toBeVisible()
  recover()
  await panel.getByRole('button', { name: 'Try again' }).click()
  await expect(panel.getByText('No public series yet.')).toBeVisible()
})
