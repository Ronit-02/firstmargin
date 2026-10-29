import { test, expect } from './support/ui-test.js'

test('writer opportunities show ranked reader demand on phone', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'opportunity-test-token', user: 'Maya Sen', email: 'maya@inkrider.local', role: 'regular' }) })
    if (url.pathname === '/api/v1/notifications') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    if (url.pathname === '/api/question/opportunities') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: '507f1f77bcf86cd799439050', text: 'How can cities preserve neighborhood memory?', context: 'A practical answer would help readers.', tags: ['science'], fitScore: 86.4, reason: 'Matches your published topic: science', upvotesCount: 12, followersCount: 4 }], meta: { summary: { openQuestions: 3, totalUpvotes: 27, topTopics: [{ topic: 'science', upvotes: 12 }] }, writerTopics: ['science'] } }) })
    return route.fulfill({ status: 404, json: { message: 'No fixture for this endpoint' } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/opportunities', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Answer what readers are asking for' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recommended questions' })).toBeVisible()
  await expect(page.getByText('How can cities preserve neighborhood memory?')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Write response' })).toHaveAttribute('href', '/studio?question=507f1f77bcf86cd799439050')
  await expect(page.getByRole('link', { name: 'Questions about science' })).toHaveAttribute('href', '/search?q=science&type=questions')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
