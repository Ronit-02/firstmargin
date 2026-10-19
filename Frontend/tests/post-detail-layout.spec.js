import { test, expect } from '@playwright/test'

const postId = '507f1f77bcf86cd799439012'
const post = {
  _id: postId, title: 'The Case for Slower Digital Mornings',
  body: JSON.stringify([{ id: 'text', type: 'text', content: 'Take time to read and reflect before starting the day.' }]),
  coverImage: null, tags: ['science', 'travel'], likesCount: 30, commentsCount: 0,
  createdAt: '2026-09-08T08:00:00Z', readTime: '5 mins', isLiked: false, isBookmarked: false,
  author: { _id: '507f1f77bcf86cd799439011', username: 'Leila Noor', handle: 'leila-noor', picture: null },
}

async function mockArticle(page, { member = true, capabilities = [], longName = false } = {}) {
  let saved = false
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(member
      ? { json: { accessToken: 'layout-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } }
      : { status: 401, json: { message: 'Signed out' } })
    if (path === `/api/post/${postId}/bookmark`) {
      saved = route.request().method() === 'PUT'
      return route.fulfill({ json: { isBookmarked: saved } })
    }
    if (path === `/api/post/${postId}`) return route.fulfill({ json: { postData: { ...post, isBookmarked: saved, author: { ...post.author, username: longName ? 'Leila Noor With A Longer Writer Name' : post.author.username } } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities } } })
    if (path.endsWith('/summary')) return route.fulfill({ json: { data: { points: ['A calmer start to the morning.'], disclosure: 'Generated overview of this article revision.' } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
}

for (const width of [320, 1280]) {
  test(`article avatar and name retain profile navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockArticle(page)
    await page.goto(`/post/${postId}`)
    await page.getByRole('link', { name: 'Open writer profile for Leila Noor', exact: true }).click()
    await expect(page).toHaveURL('/author/leila-noor')
    await page.goto(`/post/${postId}`)
    const name = page.getByRole('link', { name: "View Leila Noor's profile", exact: true })
    await name.focus()
    await name.press('Enter')
    await expect(page).toHaveURL('/author/leila-noor')
  })
}

for (const [width, theme] of [[320, 'light'], [1100, 'dark']]) {
  test(`labeled header actions preserve state and dialog focus at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await mockArticle(page)
    await page.goto(`/post/${postId}`)
    const actions = page.getByRole('group', { name: 'Article actions' })
    await actions.getByRole('button', { name: 'Save this article' }).click()
    await page.getByRole('dialog', { name: 'Save story' }).getByRole('button', { name: 'Save story', exact: true }).click()
    const saved = actions.getByRole('button', { name: 'Manage saved article' })
    await expect(saved).toHaveText('Saved')
    await expect(saved).toHaveAttribute('aria-pressed', 'true')
    await expect(saved).toBeEnabled()
    expect(await actions.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false)
    await saved.click()
    const saveDialog = page.getByRole('dialog', { name: 'Save story' })
    await saveDialog.getByRole('checkbox', { name: 'Save in your Library' }).uncheck()
    await saveDialog.getByRole('button', { name: 'Remove from Library' }).click()
    await expect(actions.getByRole('button', { name: 'Save this article' })).toHaveText('Save')
    const share = actions.getByRole('button', { name: 'Share this story' })
    await share.click()
    await expect(page.getByRole('dialog', { name: 'Share story', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(share).toBeFocused()
    const report = actions.getByRole('button', { name: 'Report this post', exact: true })
    await report.click()
    await expect(page.getByRole('dialog', { name: 'Report this post', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(report).toBeFocused()
  })
}

for (const width of [320, 390, 640, 768, 1023, 1024, 1100, 1279, 1280, 1440, 1920]) {
  test(`post header and reading tools fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockArticle(page)
    await page.goto(`/post/${postId}`)
    const main = page.getByRole('main')
    const title = main.getByRole('heading', { name: post.title, level: 1 })
    const author = main.getByRole('link', { name: "View Leila Noor's profile" })
    const date = main.getByText('8 September 2026', { exact: false }).first()
    const name = author.getByText(post.author.username, { exact: true })
    const actions = main.getByRole('button', { name: 'Appreciate this story' })
    const tools = main.getByRole('group', { name: 'Article tools' })
    await expect(title).toBeVisible()
    const authorBox = await author.locator('..').locator('..').boundingBox()
    const dateBox = await date.boundingBox()
    const actionBox = await actions.boundingBox()
    const toolsBox = await tools.boundingBox()
    expect(authorBox.width).toBeGreaterThan(90)
    expect(authorBox.height).toBeGreaterThanOrEqual(44)
    expect(dateBox.height).toBeLessThan(25)
    const nameBox = await name.boundingBox()
    expect(dateBox.x).toBe(nameBox.x)
    expect(dateBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height)
    expect(dateBox.y + dateBox.height).toBeLessThanOrEqual(authorBox.y + authorBox.height)
    for (const metadata of [date, main.getByText(post.readTime, { exact: true }).first()]) {
      expect(await metadata.evaluate(node => node.closest('a'))).toBeNull()
      await metadata.click()
      await expect(page).toHaveURL(`/post/${postId}`)
    }
    const actionGroup = main.getByRole('group', { name: 'Article actions' })
    for (const button of await actionGroup.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
    await expect(actionGroup.getByRole('button', { name: 'Save this article' })).toHaveText('Save')
    await expect(actionGroup.getByRole('button', { name: 'Share this story' })).toHaveText('Share')
    if (width < 640 || actionBox.y >= authorBox.y + authorBox.height) {
      expect(actionBox.y).toBeGreaterThanOrEqual(authorBox.y + authorBox.height + 20)
    } else {
      expect(actionBox.x).toBeGreaterThanOrEqual(authorBox.x + authorBox.width)
      expect(actionBox.y).toBeLessThan(dateBox.y + dateBox.height)
    }
    if (width < 1280) {
      expect(toolsBox.y).toBeGreaterThanOrEqual(actionBox.y + actionBox.height)
      expect(toolsBox.y).toBeGreaterThan((await title.boundingBox()).y)
      await expect(tools.getByText('Article overview', { exact: true })).toBeVisible()
      expect((await tools.getByRole('button', { name: 'Read aloud' }).boundingBox()).height).toBeGreaterThanOrEqual(44)
    } else {
      expect(toolsBox.x).toBeGreaterThan((await title.boundingBox()).x + (await title.boundingBox()).width)
    }
    if (width === 390) await page.screenshot({ path: 'test-results/post-detail-mobile.png' })
    await tools.getByRole('button', { name: 'Article overview' }).click()
    const memberDialog = page.getByRole('dialog', { name: 'Member feature' })
    await expect(memberDialog.getByText(/Article overviews is included/)).toBeVisible()
    await expect(main.getByText('Member feature', { exact: true })).toHaveCount(0)
    await memberDialog.getByRole('button', { name: 'Close member feature' }).click()
    await expect(tools.getByRole('button', { name: 'Article overview' })).toBeFocused()
    await tools.getByRole('button', { name: 'Read aloud' }).click()
    await expect(memberDialog.getByText(/Read aloud is included/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(memberDialog).toHaveCount(0)
    await expect(tools.getByRole('button', { name: 'Read aloud' })).toBeFocused()
    expect(await main.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
}

test('nonmember article tools open and dismiss the membership modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await mockArticle(page)
  await page.goto(`/post/${postId}`)
  const trigger = page.getByRole('group', { name: 'Article tools' }).getByRole('button', { name: 'Article overview' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Member feature' })
  await expect(dialog.getByRole('button', { name: 'Become a member' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close member feature' })).toBeFocused()
  await page.mouse.click(5, 5)
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('entitled tools stay inline on mobile and move to the desktop rail on resize', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mockArticle(page, { capabilities: ['article_summary', 'read_aloud'], longName: true })
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await page.goto(`/post/${postId}`)
  const tools = page.getByRole('group', { name: 'Article tools' })
  await tools.getByRole('button', { name: 'Article overview' }).click()
  await expect(page.getByText('A calmer start to the morning.')).toBeVisible()
  await expect(page.getByText('Generated overview of this article revision.')).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/post-detail-dark.png' })
  await tools.getByRole('button', { name: 'Read aloud' }).click()
  await expect(page.getByText('Browser read aloud')).toBeVisible()
  await expect(page.getByText('A calmer start to the morning.')).toHaveCount(0)
  expect(await page.getByRole('main').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false)
  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(tools.getByText('Read aloud', { exact: true })).toBeVisible()
  await expect(page.getByText('Browser read aloud')).toHaveCount(1)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(tools).toHaveCount(1)
  await expect(page.getByText('Browser read aloud')).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.getByText('Browser read aloud')).toHaveCount(1)
  await tools.getByRole('button', { name: 'Read aloud' }).click()
  await expect(page.getByText('Browser read aloud')).toHaveCount(0)
})

test('guest article tools preserve the sign-in flow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mockArticle(page, { member: false })
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: 'Article overview', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
})

for (const [width, theme] of [[1100, 'light'], [1440, 'dark']]) {
  test(`long writer metadata fits the ${width}px ${theme} post layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await mockArticle(page, { longName: true, capabilities: ['article_summary'] })
    await page.goto(`/post/${postId}`)
    const main = page.getByRole('main')
    const author = main.getByRole('link', { name: 'View Leila Noor With A Longer Writer Name\'s profile' })
    await expect(author).toBeVisible()
    const date = main.getByText('8 September 2026', { exact: false }).first()
    const name = await author.getByText('Leila Noor With A Longer Writer Name', { exact: true }).boundingBox()
    expect((await date.boundingBox()).y).toBeGreaterThanOrEqual(name.y + name.height)
    expect((await date.boundingBox()).x).toBe(name.x)
    await page.screenshot({ path: `test-results/post-detail-${width}-${theme}.png` })
    await page.getByRole('group', { name: 'Article tools' }).getByRole('button', { name: 'Article overview' }).click()
    await expect(page.getByText('A calmer start to the morning.')).toBeVisible()
    expect((await main.getByRole('article', { name: 'Article body' }).boundingBox()).width).toBeGreaterThanOrEqual(360)
    expect(await main.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false)
    await page.screenshot({ path: `test-results/post-detail-${width}-${theme}-panel.png` })
  })
}
