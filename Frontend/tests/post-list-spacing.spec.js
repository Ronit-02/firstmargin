import { test, expect } from './support/ui-test.js'

for (const width of [390, 1280]) {
  for (const isOwner of [false, true]) {
    test(`wrapped post list keeps author spacing at ${width}px (owner: ${isOwner})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const posts = [1, 2, 3].map(index => ({
        id: `507f1f77bcf86cd79943902${index}`, title: `Reading idea ${index}`,
        excerpt: 'A focused observation to read and discuss.', tags: ['essays'],
        author: { username: 'Maya Sen', handle: 'maya-sen' },
        createdAt: '2026-09-08T00:00:00Z', readTime: '1 min read',
        likesCount: 0, commentsCount: 0,
      }))
      await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
        if (path === '/api/collection/507f1f77bcf86cd799439030') return route.fulfill({ json: { data: {
          id: '507f1f77bcf86cd799439030', title: 'Writer reading list', description: 'Ideas from writers.',
          visibility: 'public', author: posts[0].author, postsCount: posts.length, posts, isOwner,
        } } })
        return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
      })
      await page.goto('/collections/507f1f77bcf86cd799439030')
      const cards = page.getByRole('article')
      await expect(cards).toHaveCount(3)
      const padding = await cards.evaluateAll(elements => elements.map(element => ({
        top: parseFloat(getComputedStyle(element).paddingTop),
        bottom: parseFloat(getComputedStyle(element).paddingBottom),
      })))
      expect(padding).toEqual([{ top: 0, bottom: 24 }, { top: 24, bottom: 24 }, { top: 24, bottom: 24 }])
      await expect(cards.nth(1).getByRole('link', { name: "View Maya Sen's profile" })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}
