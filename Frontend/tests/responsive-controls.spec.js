import { test, expect } from './support/ui-test.js'

test('shared discovery pills expose selected state and phone-sized targets', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/competition') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/competitions', { waitUntil: 'domcontentloaded' })

  const active = page.getByRole('button', { name: 'Ongoing', exact: true })
  const inactive = page.getByRole('button', { name: 'Past', exact: true })
  await expect(active).toHaveAttribute('aria-pressed', 'true')
  await expect(inactive).toHaveAttribute('aria-pressed', 'false')

  const activeBounds = await active.boundingBox()
  const inactiveBounds = await inactive.boundingBox()
  expect(activeBounds?.height).toBeGreaterThanOrEqual(44)
  expect(inactiveBounds?.height).toBeGreaterThanOrEqual(44)

  await inactive.click()
  await expect(page).toHaveURL(/competitionTab=inactive/)
  await expect(active).toHaveAttribute('aria-pressed', 'false')
  await expect(inactive).toHaveAttribute('aria-pressed', 'true')
})

test('Saved library sections expose active tab state and shareable URL state on phone', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'saved-test-token', user: 'Priya Mehta', email: 'member@inkrider.local', role: 'regular' }) })
    }
    if (url.pathname === '/api/user/bookmarks') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/v1/notifications') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/saved?savedSection=stories', { waitUntil: 'domcontentloaded' })

  const navigation = page.getByRole('tablist', { name: 'Saved library sections' })
  await expect(navigation.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'Stories content' })).toBeVisible()
  for (const tab of await navigation.getByRole('tab').all()) {
    expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }

  await navigation.getByRole('tab', { name: 'Collections' }).click()
  await expect(page).toHaveURL(/\/saved\?savedSection=collections$/)
  await expect(navigation.getByRole('tab', { name: 'Collections' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'Collections content' })).toBeVisible()
  await navigation.getByRole('tab', { name: 'Collections' }).press('Home')
  await expect(navigation.getByRole('tab', { name: 'Stories' })).toBeFocused()
  await expect(page).toHaveURL(/\/saved\/?$/)
})

test('discovery loading states announce the surface currently being fetched', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (['/api/post/feed', '/api/question', '/api/competition', '/api/collection'].includes(url.pathname)) {
      await new Promise(resolve => setTimeout(resolve, 600))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/trending', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading trending stories' })).toBeVisible()
  await page.goto('/explore/questions', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading reader questions' })).toBeVisible()
  await page.goto('/explore/competitions', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading competitions' })).toBeVisible()
  await page.goto('/collections', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading collections' })).toBeVisible()
})

test('shared filters expose phone-sized controls without changing desktop sizing', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [
        { id: 'science', title: 'Science story', tags: ['science'], format: 'article', author: { username: 'Writer' } },
        { id: 'design', title: 'Design story', tags: ['design'], format: 'article', author: { username: 'Writer' } },
      ], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/trending', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByRole('button', { name: 'Filters' })
  await expect(trigger).toBeVisible()
  expect((await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Filter by topic' })
  await expect(dialog).toBeVisible()
  expect((await dialog.getByRole('button', { name: 'All', exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect((await dialog.getByRole('combobox').boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect((await dialog.getByRole('button', { name: 'Close filters' }).boundingBox())?.height).toBeGreaterThanOrEqual(44)

  await dialog.getByRole('button', { name: 'Science', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Reset filters' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Close filters' }).press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Reset filters' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Reset filters' }).press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close filters' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('search filters expose phone-sized topic and select controls', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/search') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { posts: [
        { id: 'science', title: 'Science city', tags: ['science'], createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), author: { username: 'Writer' } },
        { id: 'travel', title: 'Travel city', tags: ['travel'], createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), author: { username: 'Writer' } },
      ], writers: [], shorts: [] }, meta: { query: 'city', type: 'posts' } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=city', { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: 'Filters' })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Refine results' })
  await expect(dialog).toBeVisible()
  expect((await dialog.getByRole('button', { name: 'All', exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44)
  for (const select of await dialog.getByRole('combobox').all()) {
    expect((await select.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
})

test('search input keeps a visible keyboard focus indicator with custom outline styles', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/search') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { posts: [], writers: [], shorts: [] }, meta: { query: 'city', type: 'all' } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=city', { waitUntil: 'domcontentloaded' })

  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').focus()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  const searchInput = dialog.getByRole('combobox')
  await expect(searchInput).toBeFocused()
  await expect.poll(() => dialog.getByRole('search').evaluate(element => getComputedStyle(element).borderColor)).toBe('rgb(25, 25, 25)')
})

test('search recovery action exposes a phone-sized retry target', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/search') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=city', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Search is unavailable' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Search is unavailable')
  expect((await page.getByRole('button', { name: 'Try again' }).boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('reading history recovery is announced and retryable on phone', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'history-test-token', user: 'Priya Mehta', email: 'member@inkrider.local', role: 'regular' }) })
    }
    if (url.pathname === '/api/v1/reading-history') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
    }
    if (url.pathname === '/api/v1/notifications') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/history', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert')).toContainText('Reading history could not be loaded.')
  expect((await page.getByRole('button', { name: 'Try again' }).boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('short-read recovery is announced and retryable on phone', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/shorts') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
    }
    if (url.pathname === '/api/short-series') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/shorts', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert')).toContainText('Shorts could not be loaded.')
  expect((await page.getByRole('button', { name: 'Try again' }).boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('Home recovery action is an explicit button outside form submission semantics', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'The feed could not be loaded' })).toBeVisible()
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toHaveAttribute('type', 'button')
  expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('mobile primary navigation exposes phone-sized links and an Account action', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search', { waitUntil: 'domcontentloaded' })

  const navigation = page.getByRole('navigation', { name: 'Mobile primary navigation' })
  await expect(navigation).toBeVisible()
  const links = navigation.getByRole('link')
  await expect(links).toHaveCount(4)
  await expect(links).toHaveText(['Home', 'Explore', 'Shorts', 'Browse'])
  for (const link of await links.all()) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await expect(navigation.getByRole('link', { name: 'Shorts' })).toHaveAttribute('href', '/shorts')
  const account = navigation.getByRole('button', { name: 'Account', exact: true })
  await expect(account).toHaveAttribute('aria-haspopup', 'dialog')
  expect((await account.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('desktop sidebar keyboard resizing is bounded and persists across reload', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/explore/trending', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.localStorage.removeItem('ink-rider.sidebar-width'))
  await page.reload({ waitUntil: 'domcontentloaded' })

  const handle = page.getByRole('separator', { name: 'Resize sidebar' })
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('aria-valuenow', '200')
  await handle.focus()
  await handle.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '220')
  await handle.press('Home')
  await expect(handle).toHaveAttribute('aria-valuenow', '140')
  await handle.press('End')
  await expect(handle).toHaveAttribute('aria-valuenow', '300')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveAttribute('aria-valuenow', '300')
})

for (const width of [768, 1280]) {
  test(`desktop sidebar toggles to an icon rail at ${width}px`, async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/explore/trending')
    await page.evaluate(() => {
      localStorage.removeItem('ink-rider.sidebar-collapsed')
      localStorage.removeItem('ink-rider.sidebar-open')
      localStorage.removeItem('ink-rider.sidebar-width')
    })
    await page.reload()

    const sidebar = page.locator('aside.sidebar-desktop')
    const navigation = sidebar.getByRole('navigation', { name: 'Desktop primary navigation' })
    await expect(sidebar).toBeVisible()
    await expect(navigation.getByRole('heading', { level: 2 })).toHaveText(['Browse', 'Catalog', 'Your space'])
    await expect(navigation.getByRole('link')).toHaveText(['Home', 'Trending', 'Questions', 'Competitions', 'Shorts', 'Collections', 'Series', 'Studio'])
    await expect(navigation.getByRole('button', { name: 'Browse' })).toHaveAttribute('aria-expanded', 'true')
    await expect(navigation.getByRole('button', { name: 'Catalog' })).toHaveAttribute('aria-expanded', 'true')
    await expect(navigation.getByRole('button', { name: 'Your space' })).toHaveAttribute('aria-expanded', 'true')
    await expect(navigation.getByRole('button', { name: 'Explore' })).toHaveCount(0)
    const browseLabel = await navigation.getByRole('button', { name: 'Browse' }).getByText('Browse').boundingBox()
    const trendingLabel = await navigation.getByRole('link', { name: 'Trending' }).getByText('Trending').boundingBox()
    expect(trendingLabel.x - browseLabel.x).toBeGreaterThan(12)
    await navigation.getByRole('button', { name: 'Browse' }).click()
    await expect(navigation.getByRole('link', { name: 'Trending' })).toBeHidden()
    await expect(navigation.getByRole('link', { name: 'Studio' })).toBeVisible()
    await navigation.getByRole('button', { name: 'Browse' }).click()
    await expect(navigation.getByRole('link', { name: 'Trending' })).toBeVisible()
    await navigation.getByRole('button', { name: 'Catalog' }).click()
    await expect(navigation.getByRole('link', { name: 'Collections' })).toBeHidden()
    await expect(navigation.getByRole('link', { name: 'Series' })).toBeHidden()
    await expect(navigation.getByRole('link', { name: 'Trending' })).toBeVisible()
    await navigation.getByRole('button', { name: 'Catalog' }).click()
    await expect(navigation.getByRole('link', { name: 'Collections' })).toBeVisible()
    await navigation.getByRole('button', { name: 'Your space' }).click()
    await expect(navigation.getByRole('link', { name: 'Studio' })).toBeHidden()
    await navigation.getByRole('button', { name: 'Your space' }).click()
    await expect(navigation.getByRole('link', { name: 'Studio' })).toBeVisible()
    if (width === 1280) {
      await navigation.getByRole('button', { name: 'Browse' }).click()
      await expect(navigation.getByRole('link', { name: 'Trending' })).toBeHidden()
    }
    await expect(sidebar.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: 'Collapse sidebar' }).locator('svg path')).toHaveAttribute('d', 'm11 4-5 5 5 5')
    const sidebarBox = await sidebar.boundingBox()
    const toggleBox = await sidebar.getByRole('button', { name: 'Collapse sidebar' }).boundingBox()
    expect(toggleBox.width).toBe(32)
    expect(toggleBox.height).toBe(32)
    expect(toggleBox.x + toggleBox.width).toBeGreaterThan(sidebarBox.x + sidebarBox.width - 20)
    expect(toggleBox.y).toBeLessThan(sidebarBox.y + 60)
    await expect(page.getByRole('navigation', { name: 'Global navigation' }).getByRole('button', { name: /sidebar/i })).toHaveCount(0)
    const resize = sidebar.getByRole('separator', { name: 'Resize sidebar' })
    await resize.focus()
    await resize.press('ArrowRight')
    await expect(resize).toHaveAttribute('aria-valuenow', '220')

    if (width === 1280) {
      const widths = await page.evaluate(async () => {
        const rail = document.querySelector('aside.sidebar-desktop')
        const before = rail.getBoundingClientRect().width
        rail.querySelector('[aria-label="Collapse sidebar"]').click()
        await new Promise(resolve => window.setTimeout(resolve, 90))
        return { before, during: rail.getBoundingClientRect().width }
      })
      expect(widths.during).toBeLessThan(widths.before)
      expect(widths.during).toBeGreaterThan(64)
    } else {
      await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
    }
    await expect(sidebar).toBeVisible()
    await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(64)
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' }).locator('svg path')).toHaveAttribute('d', 'm7 4 5 5-5 5')
    expect((await sidebar.getByRole('button', { name: 'Expand sidebar' }).boundingBox()).width).toBe(32)
    await expect(resize).toHaveCount(0)
    await expect(navigation.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Trending' })).toHaveAttribute('href', '/explore/trending')
    await expect(navigation.getByRole('link', { name: 'Questions' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Competitions' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Collections' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Series' })).toBeVisible()
    await expect(navigation.getByText('Browse')).toHaveCount(0)
    await expect(navigation.getByText('Catalog')).toHaveCount(0)
    await expect(navigation.getByRole('link', { name: 'Settings' })).toHaveCount(0)
    await expect(navigation.getByText('Studio')).toHaveClass(/max-w-0/)
    await page.screenshot({ path: `node_modules/.cache/profile-unified-save/sidebar-rail-${width}.png` })
    if (width === 1280) {
      await sidebar.getByRole('button', { name: 'Expand sidebar' }).click()
      await expect(navigation.getByRole('button', { name: 'Browse' })).toHaveAttribute('aria-expanded', 'false')
      await expect(navigation.getByRole('link', { name: 'Trending' })).toBeHidden()
      await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
      await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(64)
    }
    await page.reload()
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(64)

    await sidebar.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(220)
    await expect(sidebar.getByRole('separator', { name: 'Resize sidebar' })).toBeVisible()
    await expect(navigation.getByRole('button', { name: 'Browse' })).toHaveAttribute('aria-expanded', 'true')
  })
}

test('desktop sidebar expands without motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const browse = page.getByRole('button', { name: 'Browse' })
  await browse.click()
  await expect(page.getByRole('link', { name: 'Trending' })).toBeHidden()
  await browse.click()
  await expect(page.getByRole('link', { name: 'Trending' })).toBeVisible()
  const sidebar = page.locator('aside.sidebar-desktop')
  expect(await sidebar.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001)
  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(64)
})

test('short-read comments remain inline without a redundant footer button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/short-series/series-1') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'series-1', title: 'A walkable city', description: 'Two practical shorts.', entriesCount: 1, isOwner: false, author: { username: 'Maya Sen' }, entries: [{ id: 'short-1', title: 'Start with the street' }] } }) })
    }
    if (url.pathname === '/api/post/short-1') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ postData: { _id: 'short-1', title: 'Start with the street', body: JSON.stringify([{ id: 'block-1', type: 'paragraph', text: 'A short idea worth reading.' }]), author: { username: 'Maya Sen' }, readTime: '1 min read', commentsCount: 0, likesCount: 0, isLiked: false, isBookmarked: false } }) })
    }
    if (url.pathname === '/api/post/short-1/comments') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/v1/events') {
      return route.fulfill({ status: 200, json: { data: { accepted: 1 } } })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.addInitScript(() => {
    window.__scrollBehavior = null
    Element.prototype.scrollIntoView = options => { window.__scrollBehavior = options?.behavior || 'auto' }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/shorts/series/series-1', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Start with the street', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Start with the street' })).toHaveAttribute('id', 'short-read-title')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'View 0 comments' })).toHaveCount(0)
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Comments (0)' })).toBeVisible()
})

test('competition detail back navigation exposes a phone-sized target', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/competition/competition-1') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'competition-1', title: 'Writing about place', description: 'A community competition.', status: 'closed', closeDate: '2026-08-01T00:00:00.000Z', entriesCount: 0, entries: [], rules: [], prizes: [], votingMode: 'reader' } }),
      })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/competitions/competition-1', { waitUntil: 'domcontentloaded' })

  const back = page.getByRole('button', { name: 'Back', exact: true })
  await expect(back).toBeVisible()
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('404 recovery navigation exposes a phone-sized target', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/missing-route', { waitUntil: 'domcontentloaded' })

  const recovery = page.getByRole('link', { name: 'Return home' })
  await expect(page.getByRole('heading', { name: 'This page slipped between the lines.' })).toBeVisible()
  expect((await recovery.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(recovery).toHaveAttribute('href', '/')
})

test('filter reset clears topic and sort state together and uses the topic label', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [
        { id: 'public', title: 'Public collection', visibility: 'public', author: { username: 'Writer' } },
        { id: 'private', title: 'Private collection', visibility: 'private', author: { username: 'Writer' } },
      ], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.goto('/collections?collectionVisibility=private&collectionSort=popular', { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: /Filters/ })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Filter by visibility' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Reset filters' }).click()
  await expect(page).toHaveURL(/\/collections\/?$/)
})

test('short-series owner controls expose phone-sized reorder targets', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/short-series/series-1') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'series-1', title: 'A walkable city', description: 'Two practical shorts.', entriesCount: 2, isOwner: true, author: { username: 'Maya Sen' }, entries: [{ id: 'short-1', title: 'Start with the street' }, { id: 'short-2', title: 'Design for a slower city' }] } }),
      })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/shorts/series/series-1', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Edit series', exact: true }).click()
  const earlier = page.getByRole('button', { name: 'Move Start with the street earlier' })
  const later = page.getByRole('button', { name: 'Move Start with the street later' })
  await expect(earlier).toBeVisible()
  expect((await earlier.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect((await later.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('Home category controls expose phone-sized targets after deferred loading', async ({ page }) => {
  const posts = Array.from({ length: 8 }, (_, index) => ({
    id: `post-${index + 1}`,
    title: `A thoughtful story ${index + 1}`,
    excerpt: 'A short editorial excerpt.',
    image: null,
    tags: ['Science'],
    readTime: '4 min read',
    likesCount: 2,
    commentsCount: 0,
    author: { id: 'writer-1', username: 'Maya Sen', handle: 'maya-sen', picture: null },
  }))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: posts, meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/question') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await page.locator('[data-app-scroll]').evaluate(element => element.scrollTo(0, element.scrollHeight))
  const category = page.getByRole('button', { name: 'Science', exact: true })
  await expect(category).toBeVisible({ timeout: 10_000 })
  expect((await category.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('authentication fields expose native names, autocomplete, and required constraints', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.goto('/signup', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveAttribute('name', 'name')
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveAttribute('autocomplete', 'name')
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveAttribute('required', '')
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('autocomplete', 'email')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
  await expect(page.getByLabel('Confirm Password', { exact: true })).toHaveAttribute('name', 'confirmPassword')
  await expect(page.getByRole('main')).toHaveCount(1)
})

test('member hub loading exposes a named status region on phone', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'member-loading-token', user: 'Priya Mehta', email: 'member@inkrider.local', role: 'regular' }) })
    }
    if (url.pathname === '/api/v1/me/entitlements') {
      await new Promise(resolve => setTimeout(resolve, 600))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { capabilities: [] } }) })
    }
    if (url.pathname === '/api/v1/notifications') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    }
    if (url.pathname === '/api/v1/workshops') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/members', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading member hub' })).toBeVisible()
})

test('keyboard skip link moves focus to the application content region', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === '/api/post/feed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/collection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'Unconfigured fixture endpoint' } })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const skipLink = page.getByRole('link', { name: 'Skip to content' })
  await expect(skipLink).toBeAttached()
  await page.locator('body').evaluate(body => { body.tabIndex = -1; body.focus(); body.removeAttribute('tabindex') })
  await page.keyboard.press('Tab')
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})
