import { test, expect } from './support/ui-test.js'

const tags = ['science', 'travel', 'history', 'technology', 'culture']
const question = {
  id: '507f1f77bcf86cd799439050', text: 'How do neighborhoods change over time?',
  context: 'A practical answer would help readers.', tags,
  author: { username: 'Leila Noor', handle: 'leila-noor' },
  createdAt: '2026-09-08T00:00:00Z', upvotesCount: 4, isUpvoted: false,
  answersCount: 0, responsePosts: [],
}

async function mockLists(page) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: {
      accessToken: 'category-fit-test', user: 'Writer', email: 'writer@example.test', role: 'regular',
    } })
    if (path === '/api/question') return route.fulfill({ json: { data: [question], meta: { nextCursor: null } } })
    if (path === '/api/question/opportunities') return route.fulfill({ json: {
      data: [{ ...question, fitScore: 86, reason: 'Matches your writing', followersCount: 3 }],
      meta: { summary: { openQuestions: 1, totalUpvotes: 4, topTopics: [] }, writerTopics: ['science'] },
    } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
}

for (const route of ['/explore/questions', '/opportunities']) {
  test(`${route} shows complete categories on one row as width changes`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await mockLists(page)
    await page.goto(route)
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: question.text }) }).first()
    const links = card.getByRole('link', { name: /^Questions about / })
    await expect.poll(() => links.count()).toBeLessThan(tags.length)
    await expect(links.first()).toBeVisible()
    const assertOneRow = async () => {
      const positions = await links.evaluateAll(items => items.map(item => {
        const box = item.getBoundingClientRect()
        return { top: box.top, right: box.right, parentRight: item.parentElement.getBoundingClientRect().right }
      }))
      expect(new Set(positions.map(item => Math.round(item.top))).size).toBe(1)
      expect(positions.every(item => item.right <= item.parentRight + 1)).toBe(true)
    }
    await assertOneRow()
    await page.setViewportSize({ width: 1280, height: 844 })
    await expect(links).toHaveCount(tags.length)
    await assertOneRow()
    await page.setViewportSize({ width: 320, height: 844 })
    await expect.poll(() => links.count()).toBeLessThan(tags.length)
    await assertOneRow()
  })
}
