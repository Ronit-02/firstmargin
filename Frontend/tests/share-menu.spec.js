import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from '@playwright/test'

const post = { id: '507f1f77bcf86cd799439021', title: 'A focused idea', excerpt: 'A useful short explanation.', author: { username: 'Maya Sen', handle: 'maya-sen' }, tags: ['science'], readTime: '1 min read', createdAt: '2026-09-08T00:00:00Z', likesCount: 0, commentsCount: 0 }
const collection = { id: '507f1f77bcf86cd799439030', title: 'Useful ideas', description: 'A reading list.', visibility: 'public', author: post.author, postsCount: 0, posts: [], isOwner: false }
const surfaces = [
  { name: 'post detail', path: `/post/${post.id}`, trigger: 'Share this story', label: 'Share story', target: `/post/${post.id}` },
  { name: 'short detail', path: '/shorts', trigger: 'Share this short', label: 'Share short', target: `/post/${post.id}`, short: true },
  { name: 'collection detail', path: `/collections/${collection.id}`, trigger: 'Share this collection', label: 'Share collection', target: `/collections/${collection.id}` },
  { name: 'discovery card', path: '/search?q=science', trigger: `More options for ${post.title}`, label: 'Share story', target: `/post/${post.id}`, card: true },
  { name: 'featured story', path: '/explore/trending', trigger: `More options for ${post.title}`, label: 'Share story', target: `/post/${post.id}`, card: true },
  { name: 'collection card', path: '/collections', trigger: `More options for ${collection.title}`, label: 'Share collection', target: `/collections/${collection.id}`, card: true },
]

for (const width of [320, 1280]) {
  for (const surface of surfaces) {
    test(`${surface.name} uses the shared modal at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await page.addInitScript(() => {
        localStorage.setItem('ink-theme', 'light')
        window.shareCopies = []
        window.shareWindows = []
        window.failCopy = false
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async url => { if (window.failCopy) throw new Error('Unavailable'); window.shareCopies.push(url) } } })
        window.open = (...args) => { window.shareWindows.push(args); return null }
      })
      await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
        if (path === `/api/post/${post.id}`) return route.fulfill({ json: { postData: { ...post, _id: post.id, body: JSON.stringify([{ id: 'text', type: 'text', content: post.excerpt }]) } } })
        if (path === `/api/collection/${collection.id}`) return route.fulfill({ json: { data: collection } })
        if (path === '/api/collection') return route.fulfill({ json: { data: [collection], meta: { nextCursor: null } } })
        if (path === '/api/post/feed' || path === '/api/post/shorts') return route.fulfill({ json: { data: [post], meta: { nextCursor: null } } })
        if (path === '/api/search') return route.fulfill({ json: { data: { posts: [post], shorts: [post], writers: [] } } })
        return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
      })
      await page.goto(surface.path)
      if (surface.short) await page.getByRole('article').getByRole('link', { name: post.title, exact: true }).click()
      const trigger = page.getByRole('button', { name: surface.trigger, exact: true }).first()
      const open = async () => {
        await trigger.click()
        if (surface.card) await page.getByRole('menuitem', { name: 'Share link', exact: true }).click()
      }
      await open()
      const menu = page.getByRole('dialog', { name: surface.label, exact: true })
      const copy = menu.getByRole('button', { name: 'Copy Link', exact: true })
      const shareX = menu.getByRole('button', { name: 'Share on X', exact: true })
      await expect(copy).toBeFocused()
      await expectModalHeader(menu)
      await expect(menu.getByRole('button').filter({ hasText: /Copy Link|Share on X/ })).toHaveCount(2)
      await expect.poll(() => page.evaluate(() => window.shareCopies)).toEqual([])
      const bounds = await menu.locator('section').boundingBox()
      expect(bounds.width).toBeLessThanOrEqual(320)
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      expect(Math.abs(bounds.x + bounds.width / 2 - width / 2)).toBeLessThanOrEqual(1)
      expect(Math.abs(bounds.y + bounds.height / 2 - 844 / 2)).toBeLessThanOrEqual(1)
      await expect(menu.getByRole('heading', { name: surface.label })).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(surface.short ? 2 : 1)
      if (surface.short) await page.screenshot({ path: testInfo.outputPath(`short-share-${width}.png`) })
      await copy.press('Tab')
      await expect(shareX).toBeFocused()
      await shareX.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await open()
      await copy.click()
      const url = `${new URL(page.url()).origin}${surface.target}`
      await expect.poll(() => page.evaluate(() => window.shareCopies)).toEqual([url])
      await expect(trigger).toBeFocused()
      await open()
      await shareX.click()
      await expect.poll(() => page.evaluate(() => window.shareWindows)).toEqual([[`https://x.com/intent/tweet?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer']])
      await expect(trigger).toBeFocused()
      await page.evaluate(() => { window.failCopy = true })
      await open()
      await copy.click()
      await expect(menu).toBeVisible()
      await expect(page.getByText(/link could not be copied\./)).toBeVisible()
      await shareX.focus()
      await shareX.press('Tab')
      await expect(menu.getByRole('button', { name: 'Close share options' })).toBeFocused()
      await menu.getByRole('button', { name: 'Close share options' }).click()
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
      if (surface.short) await expect(page.getByRole('dialog', { name: post.title, exact: true })).toBeVisible()
      await page.evaluate(() => { localStorage.setItem('ink-theme', 'dark'); document.documentElement.classList.add('dark') })
      await open()
      await expect(menu).toBeVisible()
      if (surface.short) await page.screenshot({ path: testInfo.outputPath(`short-share-${width}-dark.png`) })
      await page.mouse.click(5, 5)
      await expect(menu).toHaveCount(0)
      if (surface.short) await expect(page.getByRole('dialog', { name: post.title, exact: true })).toBeVisible()
      await expect(page).toHaveURL(surface.path)
    })
  }
}
