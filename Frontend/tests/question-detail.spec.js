import { test, expect } from '@playwright/test'

test('question detail exposes answers, published responses, and follow controls on phone', async ({ page }) => {
  const questionId = '507f1f77bcf86cd799439040'
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    if (url.pathname === `/api/question/${questionId}`) {
      const body = JSON.stringify({ data: {
      id: questionId, text: 'How can cities preserve neighborhood memory?', context: 'Looking for a practical and humane explanation.', tags: ['science'], upvotesCount: 12, isUpvoted: false, followersCount: 4, isFollowing: false, status: 'answered', createdAt: '2026-08-24T00:00:00.000Z',
      author: { id: '507f1f77bcf86cd799439041', username: 'Priya Mehta', picture: null },
      answers: [{ id: '507f1f77bcf86cd799439042', text: 'Start by documenting lived experience with the people who hold it.', createdAt: '2026-08-24T01:00:00.000Z', upvotesCount: 3, isUpvoted: false, author: { id: '507f1f77bcf86cd799439043', username: 'Maya Sen', picture: null } }],
      responsePosts: [{ id: '507f1f77bcf86cd799439044', title: 'Designing Better Questions for Better Technology', format: 'article', excerpt: 'An editorial response to the reader question.', author: { username: 'Maya Sen', handle: 'maya-sen' }, createdAt: '2026-08-24T02:00:00.000Z', readTime: '4 min read', tags: ['design'], likesCount: 2, commentsCount: 1 }],
      } })
      return route.fulfill({ status: 200, contentType: 'application/json', body })
    }
    return route.abort('blockedbyclient')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/explore/questions/${questionId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'How can cities preserve neighborhood memory?', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Answers (1)' })).toHaveAttribute('aria-selected', 'true')
  const addResponse = page.getByRole('button', { name: 'Add a response' })
  await expect(addResponse).toContainText('+')
  const addBox = await addResponse.boundingBox()
  const upvoteBox = await page.getByRole('button', { name: 'Upvote question' }).boundingBox()
  expect(addBox.x + addBox.width).toBeLessThan(upvoteBox.x)
  expect(addBox.y).toBeCloseTo(upvoteBox.y, 0)
  await expect(page.getByText('Start by documenting lived experience with the people who hold it.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Report this answer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Designing Better Questions for Better Technology' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Story responses (1)' }).click()
  await expect(page).toHaveURL(new RegExp(`questionTab=responses`))
  await expect(page.getByRole('tab', { name: 'Story responses (1)' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-story-format="article"]')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Designing Better Questions for Better Technology' })).toBeVisible()
  await expect(page.getByText('Start by documenting lived experience with the people who hold it.')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Story responses (1)' }).press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Answers (1)' })).toBeFocused()
  await expect(page.getByText('Start by documenting lived experience with the people who hold it.')).toBeVisible()
  await page.goto(`/explore/questions/${questionId}#response-posts-title`)
  await expect(page.getByRole('tab', { name: 'Story responses (1)' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Published story responses' })).toBeFocused()
  const followButton = page.getByRole('button', { name: 'Follow question' })
  await expect(followButton).toHaveText('4')
  await expect(followButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('4 following')).toHaveCount(0)
  await expect(page.locator('main')).toHaveCount(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('question detail announces its contextual loading state', async ({ page }) => {
  const questionId = '507f1f77bcf86cd799439045'
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
    if (requestUrl.pathname === `/api/question/${questionId}`) {
      await new Promise(resolve => setTimeout(resolve, 600))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: questionId } }) })
    }
    return route.abort('blockedbyclient')
  })

  await page.goto(`/explore/questions/${questionId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status', { name: 'Loading question' })).toBeVisible()
})

test('question detail content uses the shared page width on desktop', async ({ page }) => {
  const questionId = '507f1f77bcf86cd799439047'
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === `/api/question/${questionId}`) return route.fulfill({ json: { data: { id: questionId, text: 'How can a city improve a difficult crossing?', context: 'We need a practical explanation that takes different readers into account.', author: { username: 'Noah Williams' }, tags: [], createdAt: '2026-08-24T00:00:00.000Z', upvotesCount: 0, followersCount: 0, answers: [], responsePosts: [] } } })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto(`/explore/questions/${questionId}`)
  await expect(page.getByRole('heading', { name: 'How can a city improve a difficult crossing?' })).toBeVisible()
  const widths = await page.locator('main[data-page-frame]').evaluate(main => {
    const contentWidth = main.clientWidth - parseFloat(getComputedStyle(main).paddingLeft) - parseFloat(getComputedStyle(main).paddingRight)
    return {
      contentWidth,
      title: main.querySelector('h1').getBoundingClientRect().width,
      context: main.querySelector('article > p').getBoundingClientRect().width,
      tabs: main.querySelector('[role="tablist"]').getBoundingClientRect().width,
      panel: main.querySelector('[role="tabpanel"]').getBoundingClientRect().width,
    }
  })
  for (const width of [widths.title, widths.context, widths.tabs, widths.panel]) expect(width).toBeCloseTo(widths.contentWidth, 0)
})

test('response dialog offers short answers and story responses', async ({ page }) => {
  const questionId = '507f1f77bcf86cd799439046'
  let postedAnswer = null
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'question-response-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === `/api/question/${questionId}` && route.request().method() === 'GET') return route.fulfill({ json: { data: { id: questionId, text: 'What makes a safer crossing?', tags: [], author: { username: 'Noah Williams' }, createdAt: '2026-08-24T00:00:00.000Z', upvotesCount: 0, followersCount: 0, answers: postedAnswer ? [{ id: 'answer-1', text: postedAnswer, author: { username: 'Reader' }, upvotesCount: 0 }] : [], responsePosts: [] } } })
    if (path === `/api/question/${questionId}/answers` && route.request().method() === 'POST') { postedAnswer = route.request().postDataJSON().text; return route.fulfill({ status: 201, json: { data: { answer: { id: 'answer-1', text: postedAnswer } } } }) }
    if (path === '/api/user/me/posts') return route.fulfill({ json: { data: [{ id: 'post-1', title: 'A published story', publicationStatus: 'published' }] } })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto(`/explore/questions/${questionId}`)
  await page.getByRole('button', { name: 'Add a response' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a response' })
  await expect(dialog.getByRole('button', { name: /Short answer/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Story response/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Post answer' })).toHaveCount(0)
  await dialog.getByRole('button', { name: /Story response/ }).click()
  await expect(dialog.getByRole('combobox', { name: 'Your published story' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Write a new story' })).toHaveAttribute('href', `/studio?question=${questionId}`)
  await dialog.getByRole('button', { name: /Short answer/ }).click()
  await expect(dialog.getByRole('combobox', { name: 'Your published story' })).toHaveCount(0)
  await dialog.getByRole('textbox', { name: 'Your answer' }).fill('Make signs legible and keep the crossing clear.')
  await dialog.getByRole('button', { name: 'Post answer' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Make signs legible and keep the crossing clear.')).toBeVisible()
})
