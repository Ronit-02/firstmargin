import { test, expect } from '@playwright/test'

const collection = {
  id: '507f1f77bcf86cd799439030',
  title: 'Short Reads for a Curious Mind',
  description: 'A demo public collection for testing ordering and visibility.',
  postsCount: 3,
  visibility: 'public',
  coverImage: null,
  author: { username: 'Priya Mehta With A Very Long Curator Name' },
}

async function mockCollections(page, loggedIn = true, owned = false) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: loggedIn ? 200 : 401, json: loggedIn ? { accessToken: 'collection-layout-token', user: 'Priya Mehta', email: 'member@inkrider.local', role: 'regular' } : { message: 'Signed out' } })
    if (url.pathname === '/api/collection') return route.fulfill({ json: { data: [{ ...collection, isOwner: owned }, { ...collection, id: '507f1f77bcf86cd799439031', title: 'AnUnbrokenCollectionTitleThatMustStayWithinTheCardAtPhoneWidths', author: { username: 'AnUnbrokenCuratorNameThatMustWrapWithoutOverflow' }, coverImage: '/logo/logo-dark.png' }], meta: { nextCursor: null } } })
    if (url.pathname === `/api/collection/${collection.id}`) return route.fulfill({ json: { data: { ...collection, isOwner: owned, posts: [], savedCount: 0, followersCount: 0 } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
}

test('collections fetch the next cursor page when the app pane scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const firstPage = Array.from({ length: 12 }, (_, index) => ({
    ...collection,
    id: `507f1f77bcf86cd7994390${String(index).padStart(2, '0')}`,
    title: `Collection ${index + 1}`,
  }))
  let nextPageRequests = 0
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/collection') {
      if (url.searchParams.get('cursor')) nextPageRequests += 1
      return route.fulfill({ json: url.searchParams.get('cursor')
        ? { data: [{ ...collection, id: '507f1f77bcf86cd799439099', title: 'Collection from page two' }], meta: { nextCursor: null } }
        : { data: firstPage, meta: { nextCursor: 'next' } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/collections')
  await expect(page.getByText('Collection 12', { exact: true })).toBeAttached()
  await expect(page.getByRole('button', { name: /load more/i })).toHaveCount(0)
  await page.locator('[data-app-scroll]').evaluate(node => { node.scrollTop = node.scrollHeight })
  await expect(page.getByText('Collection from page two')).toBeVisible()
  expect(nextPageRequests).toBe(1)
})

for (const width of [320, 1280]) {
  test(`Library collection actions add and filter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockCollections(page)
    await page.goto('/saved?libraryTab=collections')
    const browse = page.getByRole('link', { name: 'Browse collections' })
    const create = page.getByRole('button', { name: 'Add collection' })
    await expect(browse).toHaveCount(0)
    await expect(create).toHaveText('+Add')
    const filters = page.getByRole('button', { name: 'Filters', exact: true })
    await expect(filters).toBeVisible()
    const addBounds = await create.boundingBox()
    const filterBounds = await filters.boundingBox()
    expect(filterBounds.x).toBeGreaterThan(addBounds.x + addBounds.width)
    await create.click()
    await expect(page).toHaveURL('/saved?libraryTab=collections')
    const dialog = page.getByRole('dialog', { name: 'Create a collection' })
    await expect(dialog.getByRole('textbox', { name: /Title/ })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL('/saved?libraryTab=collections')
  })
}

test('owned collection menu omits save while keeping owner actions', async ({ page }) => {
  await mockCollections(page, true, true)
  await page.goto('/collections')
  await page.getByRole('button', { name: `More options for ${collection.title}` }).click()
  const menu = page.getByRole('menu', { name: `Options for ${collection.title}` })
  await expect(menu.getByRole('menuitem', { name: /Save collection|Remove from saved/ })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Share link' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Delete collection' })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Edit collection' }).click()
  await expect(page).toHaveURL(`/collections/${collection.id}`)
  await expect(page.getByRole('dialog', { name: 'Edit collection' })).toBeVisible()
})

test('collection card names both formats when a collection mixes stories and shorts', async ({ page }) => {
  await mockCollections(page)
  await page.route(url => new URL(url).pathname === '/api/collection', route => route.fulfill({ json: { data: [{ ...collection, storiesCount: 2, shortsCount: 1 }], meta: { nextCursor: null } } }))
  await page.goto('/collections')
  await expect(page.getByRole('article').getByText('2 stories · 1 short')).toBeVisible()
})

for (const width of [320, 325, 390, 600, 640, 768, 1280]) {
  test(`collections keep controls and card content within bounds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockCollections(page)
    await page.goto('/collections')
    await expect(page.getByRole('tab', { name: /Discover|My collections/ })).toHaveCount(0)
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(1).locator('img')).toBeVisible()
    await expect.poll(() => cards.nth(1).locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    const filters = page.getByRole('button', { name: 'Filters', exact: true })
    const filterBounds = await filters.boundingBox()
    expect(filterBounds.x + filterBounds.width).toBeLessThanOrEqual(width)
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox()
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      const metadata = card.getByText(/^by /)
      const metadataBounds = await metadata.boundingBox()
      expect(metadataBounds.y + metadataBounds.height).toBeLessThan(bounds.y + bounds.height)
      expect(metadataBounds.x + metadataBounds.width).toBeLessThan(bounds.x + bounds.width)
      const count = await card.getByText('3 stories', { exact: true }).boundingBox()
      const coverBounds = await card.locator('.collection-card__cover').boundingBox()
      const contentBounds = await card.locator('.collection-card__content').boundingBox()
      if (width >= 600) {
        expect(contentBounds.x).toBeGreaterThan(coverBounds.x + coverBounds.width)
      } else {
        expect(coverBounds.width / coverBounds.height).toBeGreaterThan(1.9)
        expect(coverBounds.width / coverBounds.height).toBeLessThan(2.1)
        expect(contentBounds.y).toBeGreaterThan(coverBounds.y + coverBounds.height)
      }
      expect(coverBounds.x + coverBounds.width).toBeLessThan(bounds.x + bounds.width)
      expect(coverBounds.y).toBeGreaterThan(bounds.y)
      if (width < 600) expect(count.y).toBeGreaterThan(coverBounds.y + coverBounds.height)
      expect(count.y).toBeLessThanOrEqual(metadataBounds.y)
      expect(bounds.height).toBeGreaterThanOrEqual(180)
      const footer = card.getByText('3 stories', { exact: true }).locator('..')
      expect(await footer.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px')
      const menuBounds = await card.getByRole('button', { name: /More options/ }).boundingBox()
      expect(menuBounds.width).toBeGreaterThanOrEqual(44)
      expect(menuBounds.height).toBeGreaterThanOrEqual(44)
      expect(menuBounds.x).toBeGreaterThanOrEqual(contentBounds.x)
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    }
    expect(await page.evaluate(() => document.querySelector('[data-app-scroll]').scrollWidth <= document.querySelector('[data-app-scroll]').clientWidth)).toBe(true)
    await filters.click()
    const dialog = page.getByRole('dialog', { name: 'Filter by visibility' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Private', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Reset filters' })).toBeDisabled()
    await expect(cards).toHaveCount(2)
    await dialog.press('Escape')
    await expect(filters).toBeFocused()
    const trigger = cards.first().getByRole('button', { name: /More options/ })
    await trigger.click()
    await expect(page.getByRole('menuitem', { name: 'Save collection' })).toBeFocused()
    await page.getByRole('menuitem', { name: 'Save collection' }).press('Escape')
    await expect(trigger).toBeFocused()
    if (width === 325 || width === 1280) await page.screenshot({ path: `test-results/collections-${width}.png` })
  })
}

test('guest collections and dark narrow cards retain navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await mockCollections(page, false)
  await page.goto('/collections')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('tab', { name: /Discover|My collections/ })).toHaveCount(0)
  await expect(page.getByRole('article').first().getByText(`by ${collection.author.username}`)).toBeVisible()
  await page.screenshot({ path: 'test-results/collections-dark-320.png' })
  await page.getByRole('link', { name: collection.title, exact: true }).click()
  await expect(page).toHaveURL(`/collections/${collection.id}`)
})

for (const width of [320, 1280]) {
  test(`collection card opens details from its full surface at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockCollections(page, false)
    for (const target of ['description', 'cover', 'count', 'curator', 'padding', 'keyboard']) {
      await page.goto('/collections')
      const card = page.getByRole('article').first()
      await expect(card).toBeVisible()
      const clickCardArea = async (area, offset = null) => {
        await card.scrollIntoViewIfNeeded()
        const areaBounds = await area.boundingBox()
        const cardBounds = await card.boundingBox()
        await card.click({ position: { x: areaBounds.x - cardBounds.x + (offset?.x ?? 5), y: areaBounds.y - cardBounds.y + (offset?.y ?? areaBounds.height / 2) } })
      }
      if (target === 'description') await clickCardArea(card.getByText(collection.description, { exact: true }))
      if (target === 'cover') await clickCardArea(card.locator('.collection-card__cover'), { x: 10, y: 100 })
      if (target === 'count') await clickCardArea(card.getByText('3 stories', { exact: true }))
      if (target === 'curator') await clickCardArea(card.getByText(`by ${collection.author.username}`))
      if (target === 'padding') await card.click({ position: { x: 5, y: 5 } })
      if (target === 'keyboard') await card.getByRole('link', { name: collection.title, exact: true }).press('Enter')
      await expect(page, `Detail navigation from ${target}`).toHaveURL(`/collections/${collection.id}`)
      await expect(page.getByRole('heading', { level: 1, name: collection.title, exact: true })).toBeVisible()
    }
    await page.goto('/collections')
    const trigger = page.getByRole('button', { name: `More options for ${collection.title}` })
    await trigger.click()
    await expect(page).toHaveURL('/collections')
    const menu = page.getByRole('menu', { name: `Options for ${collection.title}` })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: 'Save collection' }).press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.click()
    await menu.getByRole('menuitem', { name: 'Not interested' }).click()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page).toHaveURL('/collections')
  })
}
