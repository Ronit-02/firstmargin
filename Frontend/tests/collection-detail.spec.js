import { test, expect } from '@playwright/test'

const collectionId = '507f1f77bcf86cd799439030'
const collection = {
  id: collectionId,
  title: 'Cities worth reading slowly',
  description: 'A deterministic collection fixture for reading-order controls.',
  coverImage: null,
  postsCount: 2,
  visibility: 'public',
  isOwner: true,
  author: { username: 'Maya Sen' },
  posts: [
    { id: '507f1f77bcf86cd799439031', title: 'First story', author: { username: 'Maya Sen' }, readTime: '3 min read' },
    { id: '507f1f77bcf86cd799439032', title: 'Second story', author: { username: 'Maya Sen' }, readTime: '4 min read' },
  ],
}

test('canceling collection image selection keeps edit open', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'collection-owner', user: 'Maya Sen', email: 'maya@example.test', role: 'regular' } })
    if (pathname === `/api/collection/${collectionId}`) return route.fulfill({ json: { data: collection } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'}/collections/${collectionId}`)
  await page.getByRole('button', { name: 'Edit collection' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit collection' })
  await dialog.locator('input[type="file"]').evaluate(input => {
    input.click = () => {}
  })
  await dialog.getByRole('button', { name: 'Replace image' }).click()
  await page.keyboard.press('Escape')
  await dialog.locator('input[type="file"]').evaluate(input => input.dispatchEvent(new Event('cancel', { bubbles: true })))
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(550)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('owner adds a published story directly from collection detail', async ({ page }) => {
  const story = { id: '507f1f77bcf86cd799439033', title: 'Third story', format: 'article', author: { username: 'Maya Sen' }, readTime: '2 min read' }
  let added = false
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'collection-owner', user: 'Maya Sen', email: 'maya@example.test', role: 'regular' } })
    if (pathname === `/api/collection/${collectionId}`) return route.fulfill({ json: { data: { ...collection, posts: added ? [...collection.posts, story] : collection.posts, savedCount: 0, followersCount: 0 } } })
    if (pathname === '/api/collection/eligible-posts') return route.fulfill({ json: { data: [story] } })
    if (pathname === `/api/v1/collections/${collectionId}/posts/${story.id}`) { writes.push(route.request().method()); added = true; return route.fulfill({ json: { data: { added: true } } }) }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto(`/collections/${collectionId}`)
  const opener = page.getByRole('button', { name: 'Add to collection', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Add to collection', exact: true })
  await dialog.getByRole('combobox', { name: 'Choose a published story' }).click()
  await dialog.getByRole('option', { name: story.title }).click()
  await dialog.getByRole('button', { name: 'Add to collection', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.getByRole('heading', { name: story.title })).toBeVisible()
  expect(writes).toEqual(['PUT'])
})

test('collection save stays visibly pending through the write and refresh, and recovers after failure', async ({ page }) => {
  let isSaved = false
  let pendingWrite
  let pendingRead
  let holdRead = false
  const methods = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'pending-save-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (pathname === `/api/collection/${collectionId}/save`) {
      methods.push(route.request().method())
      const succeed = await new Promise(resolve => { pendingWrite = resolve })
      if (!succeed) return route.fulfill({ status: 500, json: { message: 'Unable to save' } })
      isSaved = route.request().method() === 'PUT'
      holdRead = true
      return route.fulfill({ json: { data: { isSaved } } })
    }
    if (pathname === `/api/collection/${collectionId}`) {
      if (holdRead) await new Promise(resolve => { pendingRead = resolve })
      return route.fulfill({ json: { data: { ...collection, isOwner: false, isSaved, posts: [], savedCount: isSaved ? 1 : 0, followersCount: 0 } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/collections/${collectionId}`)
  await page.getByRole('button', { name: 'Save this collection', exact: true }).click()
  const saving = page.getByRole('button', { name: 'Save this collection', exact: true })
  await expect(saving).toBeDisabled()
  await expect(saving).toHaveAttribute('aria-busy', 'true')
  await expect(saving).toHaveAttribute('aria-pressed', 'false')
  await expect(saving.locator('svg')).not.toHaveClass(/animate-spin/)
  await expect(saving).toHaveCSS('opacity', '1')
  await expect(saving).toHaveCSS('cursor', 'wait')
  await saving.evaluate(element => element.click())
  await expect.poll(() => methods.length).toBe(1)
  await expect.poll(() => Boolean(pendingWrite)).toBe(true)
  pendingWrite(true)
  await expect.poll(() => Boolean(pendingRead)).toBe(true)
  await expect(saving).toBeDisabled()
  holdRead = false
  pendingRead()
  const saved = page.getByRole('button', { name: 'Remove from saved collections', exact: true })
  await expect(saved).toBeEnabled()
  await expect(saved).toHaveAttribute('aria-pressed', 'true')
  await saved.click()
  const removing = page.getByRole('button', { name: 'Remove from saved collections', exact: true })
  await expect(removing).toBeDisabled()
  await expect(removing).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => methods.length).toBe(2)
  pendingWrite(false)
  await expect(saved).toBeEnabled()
  await expect(saved).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('The collection action could not be updated.')).toBeVisible()
  await saved.click()
  await expect(removing).toBeDisabled()
  await expect.poll(() => methods.length).toBe(3)
  pendingRead = null
  pendingWrite(true)
  await expect.poll(() => Boolean(pendingRead)).toBe(true)
  await expect(removing).toBeDisabled()
  holdRead = false
  pendingRead()
  await expect(page.getByRole('button', { name: 'Save this collection', exact: true })).toBeEnabled()
  expect(methods).toEqual(['PUT', 'DELETE', 'DELETE'])
})

for (const width of [320, 1280]) {
  test(`collection curator row opens the stored writer profile at ${width}px`, async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      if (pathname === `/api/collection/${collectionId}`) return route.fulfill({ json: { data: { ...collection, posts: [], savedCount: 2, followersCount: 1, author: { username: 'Maya Sen', handle: 'maya-curates' } } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.setViewportSize({ width, height: 844 })
    for (const target of ['avatar', 'name', 'counts', 'keyboard']) {
      await page.goto(`/collections/${collectionId}`)
      const curator = page.getByRole('link', { name: "View Maya Sen's profile" })
      await expect(curator).toHaveAttribute('href', '/author/maya-curates')
      if (target === 'avatar') await curator.click({ position: { x: 16, y: 16 } })
      if (target === 'name') await curator.getByText('Curated by Maya Sen').click()
      if (target === 'counts') await curator.getByText('2 stories · 2 saves · 1 followers').click()
      if (target === 'keyboard') await curator.press('Enter')
      await expect(page).toHaveURL('/author/maya-curates')
    }
  })
}

for (const width of [390, 1280]) {
  test(`collection header keeps title, actions, and curator spacing stable at ${width}px`, async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'collection-owner', user: 'Maya Sen', email: 'maya@example.test', role: 'regular' } })
      if (pathname === `/api/collection/${collectionId}`) return route.fulfill({ json: { data: { ...collection, title: 'A much longer collection title that wraps over several lines without changing the header layout', description: 'A deliberately longer description confirms that additional wrapped content does not move the collection actions or curator profile into an uneven layout.', posts: [], savedCount: 2, followersCount: 1 } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/collections/${collectionId}`)

    const title = page.getByRole('heading', { level: 1 })
    const actions = page.getByRole('button', { name: 'Edit collection' })
    const curator = page.getByRole('link', { name: "View Maya Sen's profile" })
    const [titleBounds, actionBounds, curatorBounds] = await Promise.all([title.boundingBox(), actions.boundingBox(), curator.boundingBox()])

    expect(titleBounds.y + titleBounds.height).toBeLessThan(curatorBounds.y)
    if (width < 1024) {
      expect(curatorBounds.x + curatorBounds.width).toBeLessThanOrEqual(actionBounds.x)
      expect(Math.abs((curatorBounds.y + curatorBounds.height / 2) - (actionBounds.y + actionBounds.height / 2))).toBeLessThanOrEqual(1)
    } else {
      expect(actionBounds.x).toBeGreaterThan(titleBounds.x + titleBounds.width)
      expect(actionBounds.y).toBeLessThan(curatorBounds.y)
    }
  })
}

for (const width of [320, 1280]) {
  test(`collection detail uses save/share icons and omits follow at ${width}px`, async ({ page }) => {
    let isSaved = false
    const saveMethods = []
    await page.addInitScript(() => {
      window.collectionCopies = []
      window.collectionShares = []
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async url => {
        if (window.failCollectionCopy) throw new Error('Clipboard unavailable')
        window.collectionCopies.push(url)
      } } })
      window.open = (...args) => window.collectionShares.push(args)
    })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'collection-icons-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
      if (url.pathname === `/api/collection/${collectionId}/save`) {
        saveMethods.push(route.request().method())
        isSaved = route.request().method() === 'PUT'
        return route.fulfill({ json: { data: { isSaved } } })
      }
      if (url.pathname === `/api/collection/${collectionId}`) return route.fulfill({ json: { data: { ...collection, isOwner: false, isSaved, posts: [], savedCount: isSaved ? 1 : 0, followersCount: 0 } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/collections/${collectionId}`)
    const save = page.getByRole('button', { name: 'Save this collection', exact: true })
    const share = page.getByRole('button', { name: 'Share this collection', exact: true })
    for (const control of [save, share]) {
      await expect(control.locator('svg')).toBeVisible()
      await expect(control).toHaveText('')
      const bounds = await control.boundingBox()
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.getByRole('button', { name: /^(Follow|Following)$/ })).toHaveCount(0)
    await save.press('Enter')
    const saved = page.getByRole('button', { name: 'Remove from saved collections' })
    await expect(saved).toHaveAttribute('aria-pressed', 'true')
    await expect(saved.locator('svg')).toHaveAttribute('fill', 'currentColor')
    await saved.click()
    await expect(save).toHaveAttribute('aria-pressed', 'false')
    expect(saveMethods).toEqual(['PUT', 'DELETE'])
    await share.press('Enter')
    const menu = page.getByRole('dialog', { name: 'Share collection' })
    const copy = menu.getByRole('button', { name: 'Copy Link' })
    const shareX = menu.getByRole('button', { name: 'Share on X' })
    await expect(menu.getByRole('button').filter({ hasText: /Copy Link|Share on X/ })).toHaveCount(2)
    await expect(copy).toBeFocused()
    const bounds = await menu.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    await copy.press('Tab')
    await expect(shareX).toBeFocused()
    await shareX.press('Escape')
    await expect(menu).toBeHidden()
    await expect(share).toBeFocused()
    await expect(share).toHaveAttribute('aria-expanded', 'false')
    await share.click()
    await copy.click()
    await expect.poll(() => page.evaluate(() => window.collectionCopies)).toEqual([page.url()])
    await expect(page.getByText('Collection link copied.', { exact: true })).toBeVisible()
    await expect(share).toBeFocused()
    await share.click()
    await shareX.click()
    await expect.poll(() => page.evaluate(() => window.collectionShares)).toEqual([[`https://x.com/intent/tweet?url=${encodeURIComponent(page.url())}`, '_blank', 'noopener,noreferrer']])
    await expect(menu).toBeHidden()
    await expect(share).toBeFocused()
    await page.evaluate(() => { window.failCollectionCopy = true })
    await share.click()
    await copy.click()
    await expect(page.getByText('The collection link could not be copied.', { exact: true })).toBeVisible()
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: 'Close share options' }).click()
    await expect(menu).toBeHidden()
  })
}

test('collection reading-order controls are keyboard reachable and phone-sized', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === `/api/collection/${collectionId}`) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: collection }) })
    }
    return route.abort('blockedbyclient')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/collections/${collectionId}`, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('link', { name: "View Maya Sen's profile" }).filter({ hasText: 'Curated by Maya Sen' })).toHaveAttribute('href', '/author')
  const earlier = page.getByRole('button', { name: 'Move Second story earlier' })
  const later = page.getByRole('button', { name: 'Move First story later' })
  await expect(earlier).toBeVisible()
  await expect(later).toBeVisible()
  expect((await earlier.boundingBox()).width).toBeGreaterThanOrEqual(40)
  expect((await earlier.boundingBox()).height).toBeGreaterThanOrEqual(40)

  await later.focus()
  await expect(later).toBeFocused()
  await earlier.focus()
  await expect(earlier).toBeFocused()

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})

test('collection error state preserves the application main landmark', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    }
    if (url.pathname === `/api/collection/${collectionId}`) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) })
    }
    return route.abort('blockedbyclient')
  })

  await page.goto(`/collections/${collectionId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'This collection is no longer available' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore collections' })).toHaveAttribute('href', '/collections')
  await expect(page.locator('main')).toHaveCount(1)
})

test('an invalid collection id uses the same recovery state as a missing collection', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    if (url.pathname === '/api/collection/not-an-id') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid collection id' }) })
    return route.abort('blockedbyclient')
  })

  await page.goto('/collections/not-an-id', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'This collection is no longer available' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore collections' })).toHaveAttribute('href', '/collections')
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
})
