import { test, expect } from '@playwright/test'

const story = { id: 'popular-story', title: 'A popular story', excerpt: 'A useful story to discover.', format: 'article', author: { id: 'writer', username: 'Maya Sen', handle: 'maya' }, tags: ['science'], likesCount: 8, commentsCount: 0, createdAt: '2026-10-01T10:00:00Z' }
const short = { ...story, id: 'popular-short', title: 'A popular short', format: 'short' }
const question = { id: 'popular-question', text: 'What makes a question useful?', context: 'Practical ideas from readers.', author: story.author, tags: ['science'], createdAt: story.createdAt, upvotesCount: 7, isUpvoted: false, answersCount: 0, responsePosts: [] }
const results = { posts: [story, { ...story, id: 'other-story', title: 'Another story', tags: ['travel'] }], shorts: [short], questions: [question] }

async function mockSearch(page, { fail = false, empty = false } = {}) {
  const searches = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/search') {
      searches.push(Object.fromEntries(url.searchParams))
      if (fail) { fail = false; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
      const type = url.searchParams.get('type')
      return route.fulfill({ json: { data: { posts: [], writers: [], shorts: [], questions: [], [type]: empty ? [] : results[type] || [] } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return searches
}

for (const width of [320, 1280]) {
  test(`global search accepts empty and whitespace submissions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const searches = await mockSearch(page)
    await page.goto('/help')
    const navbarSearch = page.getByRole('combobox', { name: 'Search stories and writers', exact: true })
    await navbarSearch.click()
    const input = width < 768 ? page.getByRole('dialog', { name: 'Search firstmargin' }).getByRole('combobox', { name: 'Search stories and writers', exact: true }) : navbarSearch
    if (width < 768) {
      const submit = page.getByRole('dialog', { name: 'Search firstmargin' }).getByRole('button', { name: 'Search', exact: true })
      await expect(submit).toBeEnabled()
      await submit.click()
    } else await input.press('Enter')
    await expect(page).toHaveURL('/search')
    await expect(page.getByRole('tabpanel').getByText('Popular stories', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Search firstmargin' })).toHaveCount(0)
    await page.goto('/search?q=curiosity&type=questions&topic=science')
    await navbarSearch.click()
    await input.fill('   ')
    await input.press('Enter')
    await expect(page).toHaveURL('/search?type=questions')
    await expect(page.getByRole('tabpanel').getByText('Popular questions', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Search firstmargin' })).toHaveCount(0)
    expect(searches.some(search => search.q === '' && search.type === 'questions')).toBe(true)
    await page.goto('/search?type=writers&q=maya')
    await navbarSearch.click()
    await input.fill('')
    await input.press('Enter')
    await expect(page).toHaveURL('/search?type=writers')
    await expect(page.getByRole('tabpanel').getByText('Top authors', { exact: true })).toBeVisible()
  })

  test(`empty search browses popular content across tabs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const searches = await mockSearch(page)
    await page.goto('/search')
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByText('Popular stories', { exact: true })).toBeVisible()
    await expect(panel.getByRole('heading', { name: story.title, exact: true })).toBeVisible()
    await expect(page.locator('main input')).toHaveCount(0)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toContainText('Most popular')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Shorts', exact: true }).click()
    await expect(panel.getByText('Popular shorts', { exact: true })).toBeVisible()
    await expect(panel.getByRole('heading', { name: short.title, exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Questions', exact: true }).click()
    await expect(panel.getByText('Popular questions', { exact: true })).toBeVisible()
    await expect(panel.getByRole('heading', { name: question.text, exact: true })).toBeVisible()
    await page.reload()
    await expect(panel.getByText('Popular questions', { exact: true })).toBeVisible()
    await page.goBack()
    await expect(panel.getByText('Popular shorts', { exact: true })).toBeVisible()
    expect(searches.every(search => search.q === '')).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.goto('/search?q=%20%20&type=questions')
    await expect(panel.getByText('Popular questions', { exact: true })).toBeVisible()
    await page.goto('/search?q=science&type=questions')
    await expect(panel.getByText('Showing 1 question', { exact: true })).toBeVisible()
    expect(searches.at(-1)).toMatchObject({ q: 'science', type: 'questions' })
  })
}

for (const type of ['posts', 'shorts', 'questions']) {
  test(`popular ${type} retain retry and empty recovery`, async ({ page }) => {
    await mockSearch(page, { fail: true, empty: true })
    await page.goto(`/search?type=${type}`)
    await expect(page.getByRole('alert')).toContainText('Search is unavailable')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: `No ${type === 'posts' ? 'stories' : type} found` })).toBeVisible()
    await expect(page.getByText('Try changing the filters or come back later.')).toBeVisible()
  })
}
