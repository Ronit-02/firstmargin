import { test, expect } from '@playwright/test'

const id = '507f1f77bcf86cd799439021'
const post = { id, title: 'How writers build trust', image: '/logo/logo-dark.png', tags: ['science', 'wellness'], readTime: '1 min read', createdAt: '2026-09-08T00:00:00Z', likesCount: 9, commentsCount: 0, isLiked: true }
const writer = { id: '507f1f77bcf86cd799439011', handle: 'leila-noor', displayName: 'Leila Noor', joinedAt: '2025-01-15T00:00:00Z', followersCount: 3, posts: [post] }

async function mockApi(page, { guest = false, failLike = false } = {}) {
  const methods = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: guest ? 401 : 200, json: guest ? { message: 'Signed out' } : { accessToken: 'writer-test-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/writer/leila-noor') return route.fulfill({ json: { data: { ...writer, posts: [{ ...post, isLiked: !guest }] } } })
    if (path.endsWith('/follow')) return route.fulfill({ json: { isFollowing: route.request().method() === 'PUT', followersCount: route.request().method() === 'PUT' ? 4 : 3 } })
    if (path.endsWith('/like')) {
      methods.push(route.request().method())
      const isLiked = route.request().method() === 'PUT'
      return route.fulfill({ status: failLike ? 500 : 200, json: failLike ? { message: 'Try again' } : { isLiked, likesCount: isLiked ? 9 : 8 } })
    }
    if (path.endsWith('/comments')) return route.fulfill({ json: route.request().method() === 'POST' ? { data: { id: 'comment-1', content: route.request().postDataJSON().text, author: { name: 'Reader' }, createdAt: '2026-10-08T00:00:00Z' } } : { data: [], meta: { nextCursor: null } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  return methods
}

for (const width of [320, 390, 1280]) {
  test(`writer article engagement works at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const methods = await mockApi(page)
    await page.goto('/author/leila-noor')
    const card = page.getByRole('article').first()
    const like = card.getByRole('button', { name: `Remove appreciation from ${post.title}` })
    const comments = card.getByRole('button', { name: `Comments on ${post.title}` })
    await expect(like).toHaveText('9')
    await expect(like).toHaveAttribute('aria-pressed', 'true')
    await like.click()
    const unliked = card.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })
    await expect(unliked).toHaveText('8')
    await unliked.click()
    await expect(like).toHaveText('9')
    expect(methods).toEqual(['DELETE', 'PUT'])
    await comments.click()
    const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
    await dialog.getByLabel('Add a comment', { exact: true }).fill('A useful point.')
    await dialog.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(dialog.getByText('A useful point.', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close comments' }).click()
    await expect(comments).toHaveText('1')
    await expect(comments).toBeFocused()
    await page.getByRole('button', { name: 'Follow', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Following', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Following', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
    await expect(page).toHaveURL('/author/leila-noor')
    await card.scrollIntoViewIfNeeded()
    for (const button of [like, comments]) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    while (await page.getByRole('button', { name: 'Dismiss notification' }).count()) await page.getByRole('button', { name: 'Dismiss notification' }).first().click()
    await card.screenshot({ path: testInfo.outputPath(`writer-card-${width}.png`) })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await card.screenshot({ path: testInfo.outputPath(`writer-card-${width}-dark.png`) })
    await card.getByRole('link', { name: /How writers build trust/ }).click()
    await expect(page).toHaveURL(`/post/${id}`)
  })
}

test('writer appreciation rolls back on failure', async ({ page }) => {
  await mockApi(page, { failLike: true })
  await page.goto('/author/leila-noor')
  const like = page.getByRole('button', { name: `Remove appreciation from ${post.title}` })
  await like.click()
  await expect(like).toHaveText('9')
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('The appreciation could not be updated.', { exact: true })).toBeVisible()
})

test('guest writer-card comments stay public and appreciation requests sign-in', async ({ page }) => {
  await mockApi(page, { guest: true })
  await page.goto('/author/leila-noor')
  await page.getByRole('button', { name: `Comments on ${post.title}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
  await expect(dialog.getByText('Sign in to join the conversation.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close comments' }).click()
  await page.getByRole('button', { name: `Appreciate ${post.title}`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
})
