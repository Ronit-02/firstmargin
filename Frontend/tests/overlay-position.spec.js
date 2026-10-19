import { test, expect } from '@playwright/test'

const id = '507f1f77bcf86cd799439021'
const story = { id, _id: id, title: 'A story near the bottom edge', excerpt: 'Stories for curious readers.', abstract: 'Stories for curious readers.', author: { username: 'Leila Noor', handle: 'leila-noor' }, createdAt: '2026-09-08', tags: ['science'], readTime: '1 min read', likesCount: 1, commentsCount: 0, body: JSON.stringify([{ id: 'text', type: 'text', content: 'A thoughtful short. '.repeat(60) }]) }
const collection = { id, title: 'A small reading library', description: 'Stories worth keeping together.', postsCount: 3, isOwner: true, visibility: 'public', author: { username: 'Leila Noor' } }

async function mockApi(page) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'overlay-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: Array.from({ length: 8 }, (_, i) => ({ ...story, id: i ? `507f1f77bcf86cd79943903${i}` : id, title: i ? `Story ${i}` : story.title })), writers: [], shorts: [] } } })
    if (path === '/api/post/shorts' || path === '/api/post/feed') return route.fulfill({ json: { data: [story], meta: { nextCursor: null } } })
    if (path === `/api/post/${id}`) return route.fulfill({ json: { postData: story } })
    if (path === '/api/collection') return route.fulfill({ json: { data: Array.from({ length: 8 }, (_, i) => ({ ...collection, id: i ? `507f1f77bcf86cd79943903${i}` : id, title: i ? `Collection ${i}` : collection.title })), meta: { nextCursor: null } } })
    if (path === `/api/competition/${id}`) return route.fulfill({ json: { data: { id, title: 'A writing competition', description: 'Write a thoughtful article.', status: 'open', deadline: '2027-01-01', canEnter: true, judgingMode: 'community', entries: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
}

async function assertMenuBounds(page, menu) {
  await expect(menu).toBeVisible()
  await expect.poll(() => menu.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const bottom = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
    return rect.top >= 56 && rect.bottom <= (bottom?.height ? bottom.top : window.innerHeight) - 7 && rect.left >= 0 && rect.right <= window.innerWidth
  })).toBe(true)
}

for (const width of [320, 390, 1280]) {
  for (const source of ['story', 'collection', 'featured']) {
    test(`${source} menu follows scrolling and avoids navigation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 620 })
      await mockApi(page)
      await page.goto(source === 'collection' ? '/collections' : source === 'featured' ? '/explore/trending' : '/search?q=story')
      const title = source === 'collection' ? collection.title : story.title
      const trigger = page.getByRole('button', { name: `More options for ${title}` }).first()
      await expect(trigger).toBeVisible()
      // Position the opening control just above the bottom bar, reproducing the screenshot.
      await trigger.evaluate(element => {
        const root = document.querySelector('[data-app-scroll]')
        const bottom = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
        const desired = (bottom?.height ? bottom.top : window.innerHeight) - 58
        root.scrollTop += element.getBoundingClientRect().top - desired
      })
      await trigger.click()
      const menu = page.getByRole('menu', { name: `Options for ${title}` })
      await assertMenuBounds(page, menu)
      expect(await menu.evaluate(element => element.parentElement === document.body)).toBe(true)
      if (source === 'story') {
        await menu.getByRole('menuitem', { name: 'Why you’re seeing this' }).click()
        await menu.getByRole('menuitem', { name: 'Report this post' }).click()
        const dialog = page.getByRole('dialog', { name: 'Report this post' })
        await expect(menu).toHaveCount(0)
        await dialog.getByRole('button', { name: 'Submit report' }).scrollIntoViewIfNeeded()
        await expect(dialog.getByRole('button', { name: 'Submit report' })).toBeInViewport()
        await dialog.getByRole('button', { name: 'Close report dialog' }).click()
        await trigger.click()
        await assertMenuBounds(page, menu)
      }
      await page.locator('[data-app-scroll]').evaluate(root => { root.scrollTop += 36 })
      await assertMenuBounds(page, menu)
      await page.setViewportSize({ width, height: 420 })
      // A trigger scrolled entirely out of view dismisses its menu.
      await expect.poll(async () => {
        if (!await menu.count()) return true
        return menu.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const bar = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
          return rect.top >= 56 && rect.bottom <= (bar?.height ? bar.top : window.innerHeight) - 7
        })
      }).toBe(true)
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      if (width === 390 && source === 'story') {
        await trigger.click()
        await page.screenshot({ path: 'test-results/story-menu-viewport.png' })
      }
    })
  }
}

for (const [path, button, name] of [
  ['/collections', 'Create collection', 'Create a collection'],
  ['/series?type=short', 'Create a series', 'Create a short series'],
  ['/explore/questions', 'Ask a question', 'Ask the community'],
  [`/explore/competitions/${id}`, 'Add your entry', 'Submit an article'],
]) {
  test(`${name} modal remains above navigation on a short phone screen`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 360 })
    await mockApi(page)
    await page.goto(path)
    const trigger = page.getByRole('button', { name: button, exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name, exact: true })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
    const panel = dialog.locator(':scope > section')
    const box = await panel.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(360)
    await expect(panel).toHaveCSS('overflow-y', 'auto')
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    await close.scrollIntoViewIfNeeded()
    await expect(close).toBeInViewport()
    expect(await close.evaluate(element => {
      const box = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
    })).toBe(true)
    await close.click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

test('collection delete confirmation escapes the clipped card and stays scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 })
  await mockApi(page)
  await page.goto('/collections')
  await page.getByRole('button', { name: `More options for ${collection.title}` }).click()
  await page.getByRole('menuitem', { name: 'Delete collection' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete collection?' })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.matches(':modal') && element.parentElement === document.body)).toBe(true)
  await dialog.getByRole('button', { name: 'Cancel delete' }).click()
  await expect(dialog).toHaveCount(0)
})
