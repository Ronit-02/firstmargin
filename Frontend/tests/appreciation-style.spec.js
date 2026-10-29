import { test, expect } from './support/ui-test.js'

const id = '507f1f77bcf86cd799439021'
const post = {
  id, _id: id, title: 'The Case for Slower Digital Mornings',
  body: JSON.stringify([{ id: 'text', type: 'text', content: 'Take time to read and reflect.' }]),
  excerpt: 'A quieter start to your day.', tags: ['science'],
  author: { username: 'Leila Noor', handle: 'leila-noor' },
  createdAt: '2026-09-08T00:00:00Z', readTime: '1 min read',
  likesCount: 30, commentsCount: 0, isLiked: false,
}

for (const theme of ['light', 'dark']) {
  for (const surface of ['card', 'article', 'short modal']) {
    test(`${surface} appreciation matches the article style in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 })
      await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
      let liked = false
      await page.route(url => url.pathname.startsWith('/api/'), route => {
        const path = new URL(route.request().url()).pathname
        const current = { ...post, isLiked: liked, likesCount: liked ? 31 : 30 }
        if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'style-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
        if (path.endsWith('/like')) {
          liked = route.request().method() === 'PUT'
          return route.fulfill({ json: { isLiked: liked, likesCount: liked ? 31 : 30 } })
        }
        if (path === `/api/post/${id}`) return route.fulfill({ json: { postData: current } })
        if (path === '/api/search') return route.fulfill({ json: { data: { posts: [current], writers: [], shorts: [] } } })
        if (path === '/api/post/shorts') return route.fulfill({ json: { data: [current], meta: { nextCursor: null } } })
        return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
      })
      await page.goto(surface === 'article' ? `/post/${id}` : surface === 'card' ? '/search?q=mornings' : '/shorts')
      if (surface === 'short modal') await page.getByRole('link', { name: post.title, exact: true }).click()
      const container = surface === 'short modal' ? page.getByRole('dialog') : page.getByRole('main')
      const button = container.getByRole('button', { name: /^Appreciate/ }).first()
      await expect(button).toHaveText('30')
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      await expect(button.locator('svg')).toHaveAttribute('fill', 'none')
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44)
      const unselectedBackground = await button.evaluate(element => getComputedStyle(element).backgroundColor)
      await button.click()
      const selected = container.getByRole('button', { name: /^Remove appreciation/ }).first()
      await expect(selected).toHaveText('31')
      await expect(selected).toHaveAttribute('aria-pressed', 'true')
      await expect(selected.locator('svg')).toHaveAttribute('fill', 'currentColor')
      await page.mouse.move(0, 0)
      await expect(selected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(selected).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)')
      const selectedColor = await selected.evaluate(element => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--color-accent)'
        element.appendChild(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })
      await expect(selected).toHaveCSS('color', selectedColor)
      expect(await selected.evaluate(element => parseFloat(getComputedStyle(element).borderRadius) >= element.clientHeight / 2)).toBe(true)
      await container.screenshot({ path: `test-results/appreciation-${surface.replace(' ', '-')}-${theme}.png` })
      await selected.click()
      await expect(button).toHaveText('30')
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      await page.mouse.move(0, 0)
      await expect(button).toHaveCSS('background-color', unselectedBackground)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
}
