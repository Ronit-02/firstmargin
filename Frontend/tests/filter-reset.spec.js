import { test, expect } from '@playwright/test'

const surfaces = [
  { path: '/explore/trending', topic: 'trendingTopic', sort: 'trendingSort', alternateSort: 'latest', defaultSort: 'popular' },
  { path: '/explore/questions', topic: 'questionTopic', sort: 'questionSort', alternateSort: 'newest', defaultSort: 'hot' },
]

for (const width of [320, 1280]) {
  test(`author public collections paginate and sort independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const reads = []
    const writerId = '507f1f77bcf86cd799439011'
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
      if (url.pathname === '/api/writer/writer') return route.fulfill({ json: { data: { id: writerId, displayName: 'Writer', handle: 'writer', joinedAt: '2025-01-01', followersCount: 3, posts: [{ id: 'post', title: 'A post', createdAt: '2025-01-01' }] } } })
      if (url.pathname === '/api/collection') {
        reads.push(Object.fromEntries(url.searchParams))
        const more = url.searchParams.has('cursor')
        const popular = url.searchParams.get('sort') === 'popular'
        return route.fulfill({ json: { data: [{ id: more ? 'second' : 'first', title: more ? 'Another public collection' : popular ? 'Most saved collection' : 'Latest collection', author: { id: writerId, username: 'Writer', handle: 'writer' }, visibility: 'public', postsCount: 2, savedCount: 3 }], meta: { nextCursor: more ? null : 'next-page' } } })
      }
      return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
    })
    await page.goto('/author/writer?keep=yes&authorSort=oldest#work')
    await expect(page.getByRole('heading', { name: 'A post', exact: true })).toBeVisible()
    expect(reads).toHaveLength(0)
    const section = page.getByRole('region', { name: 'Published work' })
    await section.getByRole('tab', { name: 'Stories', exact: true }).press('End')
    const category = section.getByRole('tab', { name: 'Collections', exact: true })
    await expect(category).toHaveAttribute('aria-selected', 'true')
    await expect(section.getByRole('link', { name: 'Latest collection', exact: true })).toHaveAttribute('href', '/collections/first')
    await expect(section.getByRole('heading', { name: 'A post', exact: true })).toHaveCount(0)
    await page.locator('[data-app-scroll]').evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(section.getByRole('link', { name: 'Another public collection', exact: true })).toBeVisible()
    expect(reads[0]).toMatchObject({ authorId: writerId, sort: 'latest' })
    expect(reads[0].mine).toBeUndefined()
    expect(reads[0].saved).toBeUndefined()
    expect(reads[1].cursor).toBe('next-page')
    const trigger = section.getByRole('button', { name: /Filters/ })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Filter by collections' })
    await dialog.getByRole('combobox', { name: 'Sort' }).click()
    await dialog.getByRole('option', { name: 'Most saved', exact: true }).click()
    await expect(section.getByRole('link', { name: 'Most saved collection', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close filters' }).press('Escape')
    await page.reload()
    await expect(category).toHaveAttribute('aria-selected', 'true')
    await expect(section.getByRole('link', { name: 'Most saved collection', exact: true })).toBeVisible()
    await trigger.click()
    await dialog.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL('/author/writer?keep=yes&authorSort=oldest&authorFormat=collections#work')
    await dialog.getByRole('button', { name: 'Close filters' }).click()
    await page.screenshot({ path: `node_modules/.cache/profile-work/collections-${width}.png` })
    await category.press('Home')
    await trigger.click()
    await expect(page.getByRole('dialog', { name: 'Filter by published writing' }).getByRole('combobox', { name: 'Sort' })).toHaveText('Oldest')
    expect(await page.getByRole('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  })
}

test('author collections keep identity through loading, failure, retry, and empty state', async ({ page }) => {
  let release
  const hold = new Promise(resolve => { release = resolve })
  let fail = true
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
    if (path === '/api/writer/writer') return route.fulfill({ json: { data: { id: '507f1f77bcf86cd799439011', handle: 'writer', displayName: 'Writer', joinedAt: '2025-01-01', posts: [] } } })
    if (path === '/api/collection') { await hold; return route.fulfill(fail ? { status: 500, json: {} } : { json: { data: [], meta: { nextCursor: null } } }) }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
  })
  await page.goto('/author/writer?authorFormat=collections')
  await expect(page.getByRole('heading', { name: 'Writer', exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading author collections' })).toBeVisible()
  release()
  await expect(page.getByRole('alert')).toContainText('Collections could not be loaded.')
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('No public collections yet.')).toBeVisible()
})

for (const width of [320, 1280]) {
  test(`author format and sorting persist and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const posts = [
      { id: 'older', title: 'Older post', createdAt: '2025-01-01', likesCount: 8, readTime: '2 min read' },
      { id: 'newer', title: 'Newer post', format: 'article', createdAt: '2025-03-01', likesCount: 2, readTime: '1 min read' },
      { id: 'short', title: 'A short idea', format: 'short', createdAt: '2025-02-01', likesCount: 5, readTime: '1 min read', author: { username: 'Writer', handle: 'writer' } },
    ]
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
      if (path === '/api/writer/writer') return route.fulfill({ json: { data: { id: 'writer', handle: 'writer', displayName: 'Writer', joinedAt: '2025-01-01', followersCount: 3, posts } } })
      return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
    })
    await page.goto('/author/writer?keep=reader#writing')
    const writing = page.getByRole('region', { name: 'Published work', exact: true })
    const titles = writing.locator('article h2')
    await expect(titles).toHaveText(['Newer post', 'Older post'])
    const categories = writing.getByRole('tablist', { name: 'Published writing categories' })
    await expect(categories.getByRole('tab', { name: 'Posts', exact: true })).toHaveAttribute('aria-selected', 'true')
    const trigger = writing.getByRole('button', { name: /Filters/ })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Filter by published writing' })
    await expect(dialog.getByRole('button', { name: 'Posts', exact: true })).toHaveCount(0)
    await expect(titles).toHaveText(['Newer post', 'Older post'])
    await dialog.getByRole('combobox', { name: 'Sort', exact: true }).click()
    await dialog.getByRole('option', { name: 'Oldest', exact: true }).click()
    await expect(titles).toHaveText(['Older post', 'Newer post'])
    await expect(trigger).toHaveAccessibleName('Filters (1 active)')
    await dialog.getByRole('button', { name: 'Close filters' }).press('Escape')
    await expect(trigger).toBeFocused()
    await page.reload()
    await expect(titles).toHaveText(['Older post', 'Newer post'])
    await trigger.click()
    await dialog.getByRole('combobox', { name: 'Sort', exact: true }).click()
    await dialog.getByRole('option', { name: 'Most appreciated', exact: true }).click()
    await expect(titles).toHaveText(['Older post', 'Newer post'])
    await dialog.getByRole('button', { name: 'Close filters' }).click()
    await categories.getByRole('tab', { name: 'Posts', exact: true }).press('ArrowRight')
    await expect(categories.getByRole('tab', { name: 'Shorts', exact: true })).toBeFocused()
    await expect(titles).toHaveText(['A short idea'])
    await trigger.click()
    await page.screenshot({ path: `node_modules/.cache/author-filters/filters-${width}.png` })
    const bounds = await dialog.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    await dialog.getByRole('button', { name: 'Reset filters', exact: true }).click()
    await expect(page).toHaveURL('/author/writer?keep=reader&authorFormat=short#writing')
    await expect(titles).toHaveText(['A short idea'])
    await expect(dialog.getByRole('button', { name: 'Reset filters', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Close filters' }).click()
    await page.reload()
    await expect(categories.getByRole('tab', { name: 'Shorts', exact: true })).toHaveAttribute('aria-selected', 'true')
    await categories.getByRole('tab', { name: 'Shorts', exact: true }).press('Home')
    await expect(titles).toHaveText(['Newer post', 'Older post'])
    await expect(page).toHaveURL('/author/writer?keep=reader#writing')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('author filters explain an empty matching format', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
    if (path === '/api/writer/writer') return route.fulfill({ json: { data: { displayName: 'Writer', handle: 'writer', joinedAt: '2025-01-01', posts: [{ id: 'post', title: 'Only post', createdAt: '2025-01-01' }] } } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
  })
  await page.goto('/author/writer?authorFormat=short')
  await expect(page.getByText('No published shorts yet.')).toBeVisible()
  await page.getByRole('tab', { name: 'Posts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Only post', exact: true })).toBeVisible()
})

for (const surface of surfaces) {
  for (const width of [320, 1280]) {
    test(`${surface.path} resets topic and sort together at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 735 })
      await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/auth/refresh-token') {
          return route.fulfill({ status: 401, json: { message: 'Signed out' } })
        }
        if (path === '/api/post/feed') return route.fulfill({ json: { data: [
          { id: 'science', title: 'Science story', tags: ['science'], format: 'article', author: { username: 'Writer' } },
          { id: 'design', title: 'Design story', tags: ['design'], format: 'article', author: { username: 'Writer' } },
        ], meta: { nextCursor: null } } })
        if (path === '/api/question') return route.fulfill({ json: { data: [
          { id: 'science', text: 'Science question?', tags: ['science'], author: { username: 'Reader' }, responsePosts: [], upvotesCount: 1, answersCount: 0 },
          { id: 'design', text: 'Design question?', tags: ['design'], author: { username: 'Reader' }, responsePosts: [], upvotesCount: 1, answersCount: 0 },
        ], meta: { nextCursor: null } } })
        return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
      })
      await page.goto(`${surface.path}?${surface.topic}=science&${surface.sort}=${surface.alternateSort}&keep=reader`)
      const trigger = page.getByRole('button', { name: /Filters/ })
      if (surface.path === '/explore/questions') {
        const ask = await page.getByRole('button', { name: 'Ask a question' }).boundingBox()
        const filters = await trigger.boundingBox()
        expect(Math.abs(ask.y + ask.height / 2 - filters.y - filters.height / 2)).toBeLessThan(1)
        expect(filters.x).toBeGreaterThanOrEqual(ask.x + ask.width + 11)
        if (width === 320) await page.screenshot({ path: 'test-results/questions-header-mobile.png' })
      }
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Filter by topic' })
      const reset = dialog.getByRole('button', { name: 'Reset filters' })
        await expect(trigger).toHaveAccessibleName('Filters (2 active)')
      await reset.click()
      await expect(page).toHaveURL(`${surface.path}?keep=reader`)
      await expect(dialog.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(dialog.getByRole('combobox', { name: 'Sort' })).toHaveText(surface.defaultSort === 'popular' ? 'Most appreciated' : 'Most upvoted')
      await expect(reset).toBeDisabled()
        await expect(trigger).toHaveAccessibleName('Filters')
      await dialog.getByRole('button', { name: 'Science', exact: true }).click()
      await expect(reset).toBeEnabled()
      await reset.click()
      await expect(page).toHaveURL(`${surface.path}?keep=reader`)
      await dialog.getByRole('combobox', { name: 'Sort' }).click()
      await dialog.getByRole('option', { name: surface.alternateSort === 'latest' ? 'Latest' : 'Newest', exact: true }).click()
      await expect(reset).toBeEnabled()
      await reset.click()
      await expect(page).toHaveURL(`${surface.path}?keep=reader`)
      const bounds = await dialog.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await dialog.getByRole('button', { name: 'Close filters' }).press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    })
  }
}

test('shorts reset topic and sort together', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: [
      { id: 'science', title: 'Science short', tags: ['science'], format: 'short', author: { username: 'Writer' } },
      { id: 'design', title: 'Design short', tags: ['design'], format: 'short', author: { username: 'Writer' } },
    ], meta: { nextCursor: null } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/shorts?shortTopic=science&shortSort=popular&keep=reader')
  const trigger = page.getByRole('button', { name: 'Filters (2 active)' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Filter by topic' })
  await dialog.getByRole('button', { name: 'Reset filters' }).click()
  await expect(page).toHaveURL('/shorts?keep=reader')
  await expect(dialog.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('combobox', { name: 'Sort' })).toHaveText('Latest')
  await expect(dialog.getByRole('button', { name: 'Reset filters' })).toBeDisabled()
})
