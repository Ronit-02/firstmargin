import { test, expect } from './support/ui-test.js'

for (const width of [320, 390, 1280]) {
  test(`question card keeps its preview and links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const question = {
      id: 'question-1',
      text: 'How could a city make a confusing crossing safer for a visitor who cannot read the sign, moves slowly, and arrives after dark when the pavement is wet and the route is closed?',
      author: { username: 'Noah Williams', handle: 'noah-williams' },
      createdAt: '2026-09-08T00:00:00Z',
      context: 'Interested in evidence, limitations, and real projects.',
      tags: ['science', 'coastal resilience'],
      upvotesCount: 3,
      answersCount: 2,
      responsePosts: [{ _id: 'response-1', title: 'Can Restored Reefs Protect Coastal Cities?' }],
    }
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      if (path === '/api/search') return route.fulfill({ json: { data: { questions: [question], posts: [], writers: [], shorts: [] } } })
      return route.fulfill({ json: { data: path === '/api/question' ? [question] : [], meta: { nextCursor: null } } })
    })
    await page.goto('/explore/questions')
    const card = page.getByRole('article').first()
    const title = card.getByRole('heading', { name: question.text })
    await expect(title).toBeVisible()
    await expect(card.getByRole('button', { name: 'Add response' })).toHaveCount(0)
    await expect(card.getByRole('link', { name: 'View responses' })).toHaveCount(0)
    await expect(card.getByText('2 short answers · 1 story response')).toBeVisible()
    const titleLayout = await title.evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }))
    expect(titleLayout.height).toBeLessThanOrEqual(titleLayout.lineHeight * 2 + 1)

    const tag = card.getByRole('link', { name: 'Questions about science' })
    const chip = tag.locator('span')
    const initialColor = await chip.evaluate(element => getComputedStyle(element).backgroundColor)
    await tag.hover()
    await expect.poll(() => chip.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(initialColor)
    await expect(tag).toHaveAttribute('href', '/search?q=science&type=questions')
    await expect(card.getByRole('link', { name: "View Noah Williams's profile" })).toHaveAttribute('href', '/author/noah-williams')
    await expect(card.getByRole('button', { name: 'Upvote question', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await title.getByRole('link').click()
    await expect(page).toHaveURL('/explore/questions/question-1')
  })
}
