import { test, expect } from './support/ui-test.js'

const article = {
  id: '507f1f77bcf86cd799439020',
  title: 'The quiet craft of public spaces',
  excerpt: 'A deterministic article-of-the-day fixture for keyboard coverage.',
  image: null,
  tags: ['design'],
  readTime: '4 min read',
  isLiked: false,
  isBookmarked: false,
  author: { username: 'Maya Sen', handle: 'maya-sen' },
}

const story = {
  ...article,
  id: '507f1f77bcf86cd799439021',
  title: 'How a neighborhood remembers',
  recommendationReason: 'Popular with readers following design.',
}

test('trending loads the next page when the feed reaches the scroll threshold', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  const requestedCursors = []
  const firstPage = Array.from({ length: 12 }, (_, index) => ({
    ...story,
    id: `507f1f77bcf86cd7994390${String(index).padStart(2, '0')}`,
    title: `Trending story ${index + 1}`,
  }))
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/post/feed') {
      const cursor = url.searchParams.get('cursor')
      requestedCursors.push(cursor)
      return route.fulfill({ json: cursor
        ? { data: [{ ...story, title: 'Next trending story' }], meta: { nextCursor: null } }
        : { data: firstPage, meta: { nextCursor: 'next-page' } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })

  await page.goto('/explore/trending')
  await expect(page.getByRole('heading', { name: 'Trending story 12' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0)
  expect(requestedCursors).toEqual([null])

  await page.locator('[data-app-scroll]').evaluate(node => { node.scrollTop = node.scrollHeight })
  await expect(page.getByRole('heading', { name: 'Next trending story' })).toBeVisible()
  expect(requestedCursors).toEqual([null, 'next-page'])
})

for (const width of [300, 320, 350, 390, 768, 1280]) {
  test(`trending filter label stays intact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      if (path === '/api/post/feed') return route.fulfill({ json: { data: [article, story], meta: { nextCursor: null } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.goto('/explore/trending?trendingTopic=science&trendingSort=latest')
    const trigger = page.getByRole('button', { name: /Filters/ })
    await expect(trigger).toHaveCSS('white-space', 'nowrap')
    const bounds = await trigger.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(bounds.height).toBeLessThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await trigger.click()
    await expect(page.getByRole('dialog', { name: 'Filter by topic' })).toBeVisible()
    await page.getByRole('button', { name: 'Close filters' }).press('Escape')
    await expect(trigger).toBeFocused()
    if (width === 350) await page.screenshot({ path: 'test-results/trending-filter-mobile.png' })
  })
}

test('article-of-the-day menu supports keyboard navigation and focus return', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [article, story], meta: { nextCursor: null } }),
      })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/trending', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByRole('button', { name: `More options for ${article.title}` })
  await trigger.click()

  const menu = page.getByRole('menu', { name: `Options for ${article.title}` })
  const report = menu.getByRole('menuitem', { name: 'Report this story' })
  const save = menu.getByRole('menuitem', { name: 'Save story' })
  const share = menu.getByRole('menuitem', { name: 'Share link' })
  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(save).toBeFocused()

  await save.press('ArrowDown')
  await expect(share).toBeFocused()
  await save.press('End')
  await expect(report).toBeFocused()
  await expect(menu.getByRole('menuitem', { name: 'Add to collection' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Appreciate story' })).toHaveCount(0)
  await report.press('Home')
  await expect(save).toBeFocused()
  await save.press('Escape')

  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()

  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ))
  expect(hasHorizontalOverflow).toBe(false)
})

test('discovery-card menu opens the report modal and restores keyboard navigation', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ json: { accessToken: 'report-menu-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [article, story], meta: { nextCursor: null } }),
      })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/trending', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByRole('button', { name: `More options for ${story.title}` })
  await trigger.click()

  const menu = page.getByRole('menu', { name: `Options for ${story.title}` })
  const save = menu.getByRole('menuitem', { name: 'Save story' })
  const why = menu.getByRole('menuitem', { name: 'Why you’re seeing this' })
  const hide = menu.getByRole('menuitem', { name: 'Not interested' })
  const report = menu.getByRole('menuitem', { name: 'Report this story' })
  await expect(save).toBeFocused()

  await save.press('End')
  await expect(report).toBeFocused()
  await report.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Report this story' })
  await expect(menu).toHaveCount(0)
  const reason = dialog.getByRole('combobox', { name: 'Reason', exact: true })
  await expect(reason).toBeVisible()
  await reason.focus()
  await reason.press('ArrowDown')
  await expect(reason).toBeFocused()

  await reason.press('Escape')
  await expect(dialog).toBeVisible()
  await reason.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(save).toBeFocused()
  await save.press('Home')
  await expect(save).toBeFocused()
  await save.press('ArrowUp')
  await expect(report).toBeFocused()
  await report.press('ArrowUp')
  await expect(hide).toBeFocused()
  await hide.press('ArrowUp')
  await expect(why).toBeFocused()
})
