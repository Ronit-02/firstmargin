import { test, expect } from '@playwright/test'
import { updatePostCacheValue } from '../src/features/post/hooks/postCache.js'

const id = '507f1f77bcf86cd799439011'
const containerId = '507f1f77bcf86cd799439012'
const author = { username: 'Maya Sen', handle: 'maya-sen' }
const base = { id, _id: id, title: 'A focused idea', format: 'short', author, likesCount: 3, commentsCount: 0, isLiked: false, isBookmarked: false, createdAt: '2026-10-10T12:00:00Z', publicAt: '2026-10-20T12:00:00Z' }

test('story cache traverses every supported summary shape without changing competition votes', () => {
  const entry = { id, likesCount: 27, isVoted: true, post: base }
  const input = { pages: [{ data: [{ responsePosts: [base] }] }], data: { posts: [base], shorts: [base] }, history: [base], continueReading: [base], entries: [entry, base] }
  const result = updatePostCacheValue(input, id, post => ({ ...post, isLiked: true, isBookmarked: true, likesCount: 4 }))
  for (const post of [result.pages[0].data[0].responsePosts[0], result.data.posts[0], result.data.shorts[0], result.history[0], result.continueReading[0], result.entries[0].post, result.entries[1]]) {
    expect(post.isLiked).toBe(true)
    expect(post.isBookmarked).toBe(true)
    expect(post.likesCount).toBe(4)
  }
  expect(result.entries[0].likesCount).toBe(27)
  expect(result.entries[0].isVoted).toBe(true)
  expect(input.history[0].isLiked).toBe(false)
})

async function mockPosts(page, { missingAuthor = false, format = 'short' } = {}) {
  let liked = false
  let saved = false
  let failLike = false
  const current = () => ({ ...base, format, isLiked: liked, likesCount: liked ? 4 : 3, isBookmarked: saved })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'post-test', user: 'Maya Sen', email: 'maya@example.test', role: 'regular' } })
    if (path === `/api/post/${id}/like`) {
      if (failLike) return route.fulfill({ status: 500, json: { message: 'Try again' } })
      liked = method === 'PUT'
      return route.fulfill({ json: { isLiked: liked, likesCount: liked ? 4 : 3 } })
    }
    if (path === `/api/post/${id}/bookmark`) {
      saved = method === 'PUT'
      return route.fulfill({ json: { isBookmarked: saved } })
    }
    if (path === `/api/post/${id}`) return route.fulfill({ json: { postData: { ...current(), body: JSON.stringify([{ id: 'code', type: 'code', content: 'const idea = 1' }, { id: 'line', type: 'divider' }]) } } })
    const post = { ...current(), author: missingAuthor ? undefined : author, lastReadAt: base.createdAt, progress: 20 }
    if (path === '/api/user/me') return route.fulfill({ json: { data: { displayName: 'Maya Sen', handle: 'maya-sen', joinedAt: base.createdAt, followersCount: 2, followingCount: 1, postCount: 1 } } })
    if (path === '/api/writer/maya-sen') return route.fulfill({ json: { data: { id: containerId, displayName: 'Maya Sen', handle: 'maya-sen', joinedAt: base.createdAt, followersCount: 2, isSelf: true, posts: [{ ...post, publicAt: null }] } } })
    if (path === '/api/user/me/posts') return route.fulfill({ json: { data: [post] } })
    if (path === '/api/v1/reading-history') return route.fulfill({ json: { data: { history: [post], continueReading: [post] } } })
    if (path === `/api/question/${containerId}`) return route.fulfill({ json: { data: { id: containerId, text: 'What helps us notice?', author, tags: [], answers: [], responsePosts: [post], upvotesCount: 0 } } })
    if (path === `/api/short-series/${containerId}`) return route.fulfill({ json: { data: { id: containerId, title: 'Attention', author, entriesCount: 2, isOwner: true, entries: [post, { ...post, id: 'other', _id: 'other', title: 'Second idea' }] } } })
    if (path === `/api/collection/${containerId}`) return route.fulfill({ json: { data: { id: containerId, title: 'Attention', author, posts: [post], visibility: 'public' } } })
    if (path === `/api/competition/${containerId}`) return route.fulfill({ json: { data: { id: containerId, title: 'Attention', status: 'closed', entries: [{ id: 'entry', author, likesCount: 27, post }] } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: ['early_access'], membership: { status: 'active' } } } })
    if (path === '/api/post/early-access') return route.fulfill({ json: { data: [post] } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0, totalCount: 0 } } })
  })
  return { failLike: value => { failLike = value } }
}

const surfaces = [
  ['profile', '/profile'],
  ['public writer', '/author/maya-sen'],
  ['writing', '/studio'],
  ['question', `/explore/questions/${containerId}`],
  ['history', '/history'],
  ['series', `/shorts/series/${containerId}`],
  ['collection', `/collections/${containerId}`],
  ['competition', `/explore/competitions/${containerId}`],
  ['early access', '/members'],
]

for (const [name, path] of surfaces) {
  test(`${name} short cards synchronize appreciation, save and rollback with the reader`, async ({ page }) => {
    const fixture = await mockPosts(page)
    await page.goto(path)
    if (['profile', 'public writer', 'writing', 'history'].includes(name)) await page.getByRole('tab', { name: 'Shorts', exact: true }).click()
    if (name === 'collection') await page.getByRole('group', { name: 'Collection format' }).getByRole('button', { name: 'Shorts', exact: true }).click()
    if (name === 'early access') await page.getByRole('tab', { name: 'Early access', exact: true }).click()
    if (name === 'series') await page.getByRole('button', { name: 'Move A focused idea later', exact: true }).click()
    const card = page.locator('[data-story-format="short"]').filter({ hasText: base.title }).first()
    await expect(card).toBeVisible()
    await card.getByRole('link', { name: base.title, exact: true }).click()
    const reader = page.getByRole('dialog', { name: base.title })
    await expect(reader).toBeVisible()
    fixture.failLike(true)
    await reader.getByRole('button', { name: 'Appreciate this short', exact: true }).click()
    await expect(reader.getByRole('button', { name: 'Appreciate this short', exact: true })).toHaveAttribute('aria-pressed', 'false')
    fixture.failLike(false)
    await reader.getByRole('button', { name: 'Appreciate this short', exact: true }).click()
    await expect(reader.getByRole('button', { name: 'Remove appreciation', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await reader.getByRole('button', { name: 'Save this short', exact: true }).click()
    await page.getByRole('dialog', { name: 'Save story', exact: true }).getByRole('button', { name: 'Save story', exact: true }).click()
    await expect(reader.getByRole('button', { name: 'Manage saved short', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await reader.getByRole('button', { name: 'Close short' }).click()
    await expect(card.getByRole('button', { name: `Remove appreciation from ${base.title}`, exact: true })).toHaveText('4')
    if (name !== 'writing') {
      await card.getByRole('button', { name: `More options for ${base.title}` }).click()
      const menu = page.getByRole('menu', { name: `Options for ${base.title}` })
      await expect(menu.getByRole('menuitem', { name: 'Saved' })).toBeVisible()
      await menu.press('Escape')
    }
    if (name === 'history') {
      const triggers = page.getByRole('button', { name: `More options for ${base.title}` })
      await triggers.nth(0).click()
      const firstId = await triggers.nth(0).getAttribute('aria-controls')
      await page.getByRole('menu').press('Escape')
      await triggers.nth(1).click()
      const secondId = await triggers.nth(1).getAttribute('aria-controls')
      expect(firstId).toBeTruthy()
      expect(secondId).toBeTruthy()
      expect(firstId).not.toBe(secondId)
      await page.getByRole('menu').press('Escape')
    }
  })
}

for (const path of ['/studio', `/explore/questions/${containerId}`]) {
  test(`sparse short author data remains readable at ${path}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await mockPosts(page, { missingAuthor: true })
    await page.goto(path)
    if (path === '/studio') await page.getByRole('tab', { name: 'Shorts', exact: true }).click()
    const card = page.locator('[data-story-format="short"]')
    await expect(card).toBeVisible()
    await expect(card.getByText('Unknown writer', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const theme of ['light', 'dark']) {
  for (const format of ['short', 'article']) test(`${format} reader code and dividers follow the ${theme} theme`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await mockPosts(page, { format })
    await page.goto(`/post/${id}`)
    const reader = format === 'short' ? page.getByRole('dialog', { name: base.title }) : page.getByRole('main')
    await expect(reader.locator('[data-reading-body]')).toBeVisible()
    expect(await page.locator('html').evaluate(node => node.classList.contains('dark'))).toBe(theme === 'dark')
    const colors = await reader.locator('[data-reading-body]').evaluate(node => {
      const style = getComputedStyle(document.documentElement)
      return { bg: getComputedStyle(node.querySelector('pre')).backgroundColor, border: getComputedStyle(node.querySelector('hr')).borderTopColor, expectedBg: style.getPropertyValue('--color-bg-alt').trim(), expectedBorder: style.getPropertyValue('--color-border').trim() }
    })
    const toRgb = hex => `rgb(${hex.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})`
    expect(colors.bg).toBe(toRgb(colors.expectedBg))
    expect(colors.border).toBe(toRgb(colors.expectedBorder))
  })
}

for (const [theme, width] of [['light', 320], ['dark', 1280]]) {
  for (const [name, path] of [['history', '/history'], ['early access', '/members'], ['competition', `/explore/competitions/${containerId}`]]) {
    test(`${name} article headline uses serif and separate links in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
      await mockPosts(page, { format: 'article' })
      await page.goto(path)
      if (name === 'early access') await page.getByRole('tab', { name: 'Early access', exact: true }).click()
      const headline = page.getByRole('heading', { name: base.title, exact: true }).first()
      await expect(headline).toHaveCSS('font-family', /Libre Baskerville/)
      expect(await page.locator('a a').count()).toBe(0)
      await headline.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `node_modules/.cache/post-fixes/${name.replace(' ', '-')}-${theme}.png` })
      if (name === 'history') {
        const card = headline.locator('..')
        const identity = card.getByRole('link', { name: "View Maya Sen's profile", exact: true })
        await expect(identity.locator('..')).toHaveCSS('row-gap', '8px')
        const date = card.getByText('10 October 2026', { exact: true })
        expect((await date.boundingBox()).y).toBeGreaterThan((await identity.boundingBox()).y)
        await expect(card.getByText('20% read', { exact: true })).toBeVisible()
        const progress = card.locator('.h-full')
        expect(await progress.evaluate(element => element.getBoundingClientRect().width / element.parentElement.getBoundingClientRect().width)).toBeCloseTo(0.2, 2)
        await page.getByRole('link', { name: "View Maya Sen's profile", exact: true }).first().click()
        await expect(page).toHaveURL('/author/maya-sen')
        await page.goBack()
        await page.getByRole('link', { name: base.title, exact: true }).first().click()
        await expect(page).toHaveURL(`/post/${id}`)
      }
    })
  }
}
