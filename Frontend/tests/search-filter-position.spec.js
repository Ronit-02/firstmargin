import { test, expect } from '@playwright/test'

const readerQuestion = {
  id: '507f1f77bcf86cd799439011', text: 'How can coastal cities adapt to rising seas?',
  context: 'Readers want practical evidence.', tags: ['coastal resilience', 'science'],
  author: { username: 'Maya Sen', handle: 'maya-sen' }, createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  upvotesCount: 4, isUpvoted: false, answersCount: 1, responsePosts: [{ _id: 'response', title: 'A coastal response' }],
}

async function mockQuestionSearch(page, { signedIn = false } = {}) {
  const searches = []
  const votes = []
  let count = 4
  let selected = false
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { accessToken: 'question-search-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } : { message: 'Signed out' } })
    if (url.pathname === '/api/search') {
      searches.push(Object.fromEntries(url.searchParams))
      if (url.searchParams.get('q') === 'unavailable' && searches.filter(item => item.q === 'unavailable').length === 1) return route.fulfill({ status: 500, json: { message: 'Try again' } })
      const questions = url.searchParams.get('q') === 'absent' ? [] : [
        { ...readerQuestion, upvotesCount: count, isUpvoted: selected },
        { ...readerQuestion, id: '507f1f77bcf86cd799439012', text: 'How can neighborhoods share public space?', tags: ['design'], responsePosts: [], createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
      ]
      return route.fulfill({ json: { data: { questions, posts: [], writers: [], shorts: [] } } })
    }
    if (url.pathname === `/api/question/${readerQuestion.id}/upvote`) {
      votes.push(request.method())
      if (votes.length === 2) return route.fulfill({ status: 500, json: { message: 'Vote unavailable' } })
      selected = request.method() === 'PUT'
      count = selected ? 5 : 4
      return route.fulfill({ json: { data: { isUpvoted: selected, upvotesCount: count } } })
    }
    if (url.pathname === `/api/question/${readerQuestion.id}`) return route.fulfill({ json: { data: { ...readerQuestion, answers: [], followersCount: 2 } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return { searches, votes }
}

test('search shows the displayed result count for the selected tab', async ({ page }) => {
  await mockQuestionSearch(page)
  await page.goto('/search?q=coastal&type=questions')
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText('Showing 2 questions')).toBeVisible()
  await page.getByRole('tab', { name: 'Stories' }).click()
  await expect(panel.getByText('Showing 0 stories')).toBeVisible()
  await page.goto('/search?q=absent&type=questions')
  await expect(panel.getByText('Showing 0 questions')).toBeVisible()
})

for (const width of [320, 1280]) {
  test(`Questions search retains tabs, filters, category navigation, and guest actions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'dark' : 'light')
    const { searches } = await mockQuestionSearch(page)
    await page.goto('/search?q=coastal+resilience&type=questions&keep=reader')
    const questionsTab = page.getByRole('tab', { name: 'Questions', exact: true })
    await expect(questionsTab).toHaveAttribute('aria-selected', 'true')
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('heading', { name: readerQuestion.text })).toBeVisible()
    expect(searches.at(-1)).toMatchObject({ q: 'coastal resilience', type: 'questions' })
    await questionsTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Posts', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(questionsTab).toBeFocused()
    await expect(page).toHaveURL(/type=questions/)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const filters = page.getByRole('dialog', { name: 'Refine results' })
    await filters.getByRole('button', { name: 'Science', exact: true }).click()
    await filters.getByRole('combobox', { name: 'Time' }).click()
    await page.getByRole('option', { name: 'Past week', exact: true }).click()
    await filters.getByRole('combobox', { name: 'Sort' }).click()
    await page.getByRole('option', { name: 'Latest', exact: true }).click()
    await expect.poll(() => searches.some(search => search.type === 'questions' && search.topic === 'science' && search.time === 'week' && search.sort === 'latest')).toBe(true)
    await filters.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL(url => url.pathname === '/search' && url.searchParams.get('q') === 'coastal resilience' && url.searchParams.get('type') === 'questions' && url.searchParams.get('keep') === 'reader' && !url.searchParams.has('topic') && !url.searchParams.has('time') && !url.searchParams.has('sort'))
    await filters.getByRole('button', { name: 'Close filters' }).press('Escape')
    await panel.getByRole('button', { name: 'Upvote question', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
    await page.keyboard.press('Escape')
    await panel.getByRole('link', { name: 'Questions about science', exact: true }).click()
    await expect(page).toHaveURL('/search?q=science&type=questions')
    await expect(panel.getByRole('link', { name: 'View responses' })).toHaveAttribute('href', `/explore/questions/${readerQuestion.id}#response-posts-title`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('questions-search.png'), fullPage: true })
    await panel.getByRole('heading', { name: readerQuestion.text }).getByRole('link').click()
    await expect(page).toHaveURL(`/explore/questions/${readerQuestion.id}`)
    const detailCategory = page.getByRole('link', { name: 'Questions about coastal resilience' })
    await detailCategory.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/search?q=coastal+resilience&type=questions')
    await page.reload()
    await expect(questionsTab).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('heading', { name: readerQuestion.text })).toBeVisible()
  })
}

test('question search shows empty/error recovery and refreshes votes after confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { votes } = await mockQuestionSearch(page, { signedIn: true })
  await page.goto('/search?q=absent&type=questions')
  await expect(page.getByRole('heading', { name: 'No questions found' })).toBeVisible()
  await page.goto('/search?q=unavailable&type=questions')
  await expect(page.getByRole('alert')).toContainText('Search is unavailable')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  const vote = page.getByRole('button', { name: 'Upvote question', exact: true })
  await expect(vote).toBeVisible()
  await vote.click()
  const removeVote = page.getByRole('button', { name: 'Remove upvote from question', exact: true })
  await expect(removeVote).toHaveAttribute('aria-pressed', 'true')
  await expect(removeVote).toContainText('5')
  await removeVote.click()
  await expect(page.getByRole('alert').filter({ hasText: 'The question vote could not be updated.' })).toBeVisible()
  await expect(removeVote).toHaveAttribute('aria-pressed', 'true')
  await removeVote.click()
  await expect(vote).toHaveAttribute('aria-pressed', 'false')
  await expect(vote).toContainText('4')
  expect(votes).toEqual(['PUT', 'DELETE', 'DELETE'])
})

test('question feed toggles an existing upvote without a reload', async ({ page }) => {
  let selected = true
  const methods = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'question-feed-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/question') return route.fulfill({ json: { data: [{ ...readerQuestion, isUpvoted: selected, upvotesCount: selected ? 5 : 4 }], meta: { nextCursor: null } } })
    if (path === `/api/question/${readerQuestion.id}/upvote`) {
      methods.push(route.request().method())
      selected = route.request().method() === 'PUT'
      return route.fulfill({ json: { data: { isUpvoted: selected, upvotesCount: selected ? 5 : 4 } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/explore/questions')
  const removeVote = page.getByRole('button', { name: 'Remove upvote from question' })
  await expect(removeVote).toHaveAttribute('aria-pressed', 'true')
  await removeVote.click()
  const addVote = page.getByRole('button', { name: 'Upvote question', exact: true })
  await expect(addVote).toHaveAttribute('aria-pressed', 'false')
  await expect(addVote).toContainText('4')
  await addVote.click()
  await expect(removeVote).toHaveAttribute('aria-pressed', 'true')
  await expect(removeVote).toContainText('5')
  expect(methods).toEqual(['DELETE', 'PUT'])
})

for (const width of [320, 369, 390, 1280]) {
  test(`search filter panel stays pinned and visible as results change at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 735 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      if (url.pathname === '/api/search') {
        const posts = url.searchParams.get('topic') === 'ai' ? [] : Array.from({ length: 5 }, (_, index) => ({
          id: `507f1f77bcf86cd79943901${index}`,
          title: `Practical curiosity ${index + 1}`,
          abstract: 'Explore a practical approach to science and everyday curiosity.',
          author: { id: '507f1f77bcf86cd799439011', username: 'Leila Noor', handle: 'leila-noor' },
          createdAt: new Date(Date.now() - (index === 0 ? 2 : 30) * 86400000).toISOString(), readTime: '1 min read', tags: [index === 0 ? 'ai' : 'science'], likesCount: 29, commentsCount: 0,
        }))
        return route.fulfill({ json: { data: { posts, writers: [], shorts: [] } } })
      }
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.goto('/search?q=practical')
    await expect(page.getByRole('heading', { name: 'Practical curiosity 1' })).toBeVisible()
    const trigger = page.getByRole('button', { name: 'Filters' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Refine results' })
    await expect(dialog).toBeVisible()
    const opening = await dialog.boundingBox()
    const assertPinned = async () => {
      const current = await dialog.boundingBox()
      expect(current.x).toBeCloseTo(opening.x, 0)
      expect(current.y).toBeCloseTo(opening.y, 0)
      expect(current.x).toBeGreaterThanOrEqual(0)
      expect(current.x + current.width).toBeLessThanOrEqual(width)
      expect(current.y).toBeGreaterThanOrEqual(56)
      expect(current.y + current.height).toBeLessThanOrEqual(width < 768 ? 671 : 735)
    }
    await assertPinned()
    await dialog.getByRole('button', { name: 'AI', exact: true }).click()
    await expect(page.getByText('No posts found', { exact: true })).toBeVisible()
    await assertPinned()
    await dialog.getByRole('button', { name: 'Science', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Practical curiosity 1' })).toBeVisible()
    await assertPinned()
    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Past week', exact: true }).click()
    await expect(page).toHaveURL(/time=week/)
    await assertPinned()
    await dialog.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL(/\/search\?q=practical$/)
    await assertPinned()
    if (width < 768) {
      await page.setViewportSize({ width, height: 420 })
      await expect.poll(async () => {
        const bounds = await dialog.boundingBox()
        return bounds ? bounds.y + bounds.height : Infinity
      }).toBeLessThanOrEqual(356)
      await dialog.getByRole('button', { name: 'Reset filters' }).scrollIntoViewIfNeeded()
      await expect(dialog.getByRole('button', { name: 'Reset filters' })).toBeInViewport()
    }
    await dialog.getByRole('button', { name: 'Close filters' }).press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(dialog).toBeVisible()
    await page.getByRole('link', { name: 'firstmargin home' }).click()
    await expect(dialog).toHaveCount(0)
  })
}
