import { test, expect } from '@playwright/test'

const post = {
  id: '507f1f77bcf86cd799439020', title: 'The Case for Slower Digital Mornings',
  excerpt: 'A thoughtful start to the day.', image: '/logo/logo-dark.png',
  author: { username: 'Leila Noor', handle: 'leila-noor', picture: '/logo/logo-dark.png' },
  createdAt: '2026-09-08T00:00:00Z', readTime: '4 min read',
  likesCount: 30, commentsCount: 0, isLiked: false, tags: ['design'],
}

async function mockApi(page, { signedIn = true, failLike = false, article = post } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { accessToken: 'featured-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } : { message: 'Signed out' } })
    if (path === '/api/post/feed') return route.fulfill({ json: { data: [article], meta: { nextCursor: null } } })
    if (path.endsWith('/like')) return route.fulfill({ status: failLike ? 500 : 200, json: failLike ? { message: 'Try again' } : { isLiked: route.request().method() === 'PUT', likesCount: route.request().method() === 'PUT' ? 31 : 30 } })
    if (path.endsWith('/comments')) return route.fulfill({ json: route.request().method() === 'POST' ? { data: { id: 'comment-1', content: route.request().postDataJSON().text, author: { name: 'Reader' }, createdAt: '2026-10-06T00:00:00Z' } } : { data: [], meta: { nextCursor: null } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
}

for (const width of [320, 1280]) {
  test(`featured author block and remaining card have separate destinations at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    const card = page.getByRole('article').first()
    const clickArea = async locator => {
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    for (const target of [() => card.getByText('8 September 2026', { exact: true }), () => card.getByText(post.readTime, { exact: true })]) {
      await page.goto('/explore/trending')
      await clickArea(target())
      await expect(page).toHaveURL('/explore/trending')
    }
    for (const target of [() => card.getByText('Story of the day', { exact: true }), () => card.getByText(post.excerpt, { exact: true })]) {
      await page.goto('/explore/trending')
      await clickArea(target())
      await expect(page).toHaveURL(`/post/${post.id}`)
    }
  })
}

for (const width of [320, 390, 768, 900, 960, 1024, 1280]) {
  test(`featured metadata and actions work without story navigation at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/explore/trending')
    const card = page.getByRole('article').first()
    const labelBounds = await card.getByText('Story of the day', { exact: true }).boundingBox()
    const coverBounds = await card.getByRole('link', { name: `Read ${post.title}`, exact: true }).boundingBox()
    expect(labelBounds.y + labelBounds.height).toBeLessThanOrEqual(coverBounds.y)
    await expect(card.getByText('8 September 2026', { exact: true })).toBeVisible()
    await expect(card.getByText('4 min read', { exact: true })).toBeVisible()
    const author = card.getByRole('link', { name: "View Leila Noor's profile" })
    await expect(author).toHaveAttribute('href', '/author/leila-noor')
    await expect(author.locator('img')).toHaveAttribute('src', post.author.picture)
    const menu = card.getByRole('button', { name: `More options for ${post.title}`, exact: true })
    const menuBounds = await menu.boundingBox()
    const authorBounds = await author.boundingBox()
    expect(menuBounds.x).toBeGreaterThanOrEqual(authorBounds.x + authorBounds.width)
    expect(Math.abs(menuBounds.y - authorBounds.y)).toBeLessThanOrEqual(1)
    if (width < 960) expect(menuBounds.y).toBeGreaterThanOrEqual(coverBounds.y + coverBounds.height)
    const titleBounds = await card.getByRole('heading', { name: post.title, exact: true }).boundingBox()
    const dateBounds = await card.getByText('8 September 2026', { exact: true }).boundingBox()
    expect(titleBounds.y - dateBounds.y - dateBounds.height).toBeGreaterThanOrEqual(19)
    expect((await author.boundingBox()).y).toBeLessThan(dateBounds.y)
    const metadata = author.locator('..')
    await expect(metadata).toHaveCSS('row-gap', '8px')
    const content = card.locator(':scope > div').last()
    await expect(content).toHaveCSS('row-gap', '20px')
    const bottomSpace = await content.evaluate(element => element.getBoundingClientRect().bottom - element.lastElementChild.getBoundingClientRect().bottom)
    expect(bottomSpace).toBeCloseTo(width < 960 ? 20 : 28, 0)
    if (width >= 960) {
      expect(Math.abs(authorBounds.y - coverBounds.y)).toBeLessThanOrEqual(1)
      const contentBounds = await content.boundingBox()
      expect(Math.abs(coverBounds.height - contentBounds.height)).toBeLessThanOrEqual(1)
    } else {
      expect(authorBounds.y).toBeGreaterThanOrEqual(coverBounds.y + coverBounds.height)
    }
    await expect(card.getByRole('link', { name: `Read ${post.title}` })).toHaveAttribute('href', `/post/${post.id}`)
    expect(await card.locator('a button, a a').count()).toBe(0)
    const like = card.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })
    await expect(like).toHaveText('30')
    if (width === 390 || width === 1280) await card.screenshot({ path: `test-results/article-day-${width}.png` })
    await like.click()
    const unlike = card.getByRole('button', { name: `Remove appreciation from ${post.title}` })
    await expect(unlike).toHaveText('31')
    await expect(unlike).toHaveAttribute('aria-pressed', 'true')
    await unlike.click()
    await expect(like).toHaveText('30')
    const comments = card.getByRole('button', { name: `Comments on ${post.title}` })
    const before = await card.boundingBox()
    await comments.click()
    const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
    await expect(dialog.getByRole('button', { name: 'Close comments' })).toBeFocused()
    expect((await card.boundingBox()).height).toBe(before.height)
    await dialog.getByRole('textbox', { name: 'Add a comment' }).fill('A useful featured read.')
    await dialog.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(dialog.getByText('A useful featured read.', { exact: true })).toBeVisible()
    await expect(comments).toHaveText('1')
    await page.keyboard.press('Escape')
    await expect(comments).toBeFocused()
    await expect(page).toHaveURL(/\/explore\/trending$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('featured guest can read comments and is prompted to sign in to appreciate', async ({ page }) => {
  await mockApi(page, { signedIn: false })
  await page.goto('/explore/trending')
  await page.getByRole('button', { name: `Comments on ${post.title}` }).click()
  await expect(page.getByText('Sign in to join the conversation.')).toBeVisible()
  await page.getByRole('button', { name: 'Close comments' }).click()
  await page.getByRole('button', { name: `Appreciate ${post.title}`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
})

test('featured appreciation failure restores count and state', async ({ page }) => {
  await mockApi(page, { failLike: true })
  await page.goto('/explore/trending')
  const like = page.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })
  await like.click()
  await expect(page.getByText('The appreciation could not be updated.')).toBeVisible()
  await expect(like).toHaveText('30')
  await expect(like).toHaveAttribute('aria-pressed', 'false')
})

test('featured long writer metadata wraps and missing picture falls back in dark mode', async ({ page }) => {
  await mockApi(page, { article: { ...post, author: { ...post.author, username: 'Leila'.repeat(20), picture: null } } })
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/explore/trending')
  const card = page.getByRole('article').first()
  await expect(card.getByText('Leila'.repeat(20), { exact: true })).toBeVisible()
  const nameBounds = await card.getByText('Leila'.repeat(20), { exact: true }).boundingBox()
  const cardBounds = await card.boundingBox()
  expect(nameBounds.x + nameBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width)
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await card.screenshot({ path: 'test-results/article-day-dark.png' })
})
