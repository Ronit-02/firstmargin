import { test, expect } from './support/ui-test.js'

const collectionId = '507f1f77bcf86cd799439030'
const ids = ['507f1f77bcf86cd799439031', '507f1f77bcf86cd799439032', '507f1f77bcf86cd799439033']
const author = { username: 'Maya Sen', handle: 'maya-sen' }
const posts = [
  { id: ids[0], title: 'A precise detail', format: 'short', author },
  { id: ids[1], title: 'A full exploration', format: 'article', author },
  { id: ids[2], title: 'Another short idea', format: 'short', author },
]

async function mockWriting(page, isOwner = false) {
  const orders = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(isOwner ? { json: { accessToken: 'collection-test', user: 'Maya Sen', role: 'regular' } } : { status: 401, json: { message: 'Signed out' } })
    if (path === `/api/collection/${collectionId}`) {
      if (route.request().method() === 'PUT') orders.push(route.request().postDataJSON().publicationIds)
      return route.fulfill({ json: { data: { id: collectionId, title: 'Mixed morning reads', posts, postsCount: 3, author, isOwner, visibility: 'public', savedCount: 0, followersCount: 0 } } })
    }
    if (path === '/api/search') return route.fulfill({ json: { data: { posts, shorts: posts.filter(item => item.format === 'short'), writers: [], questions: [] } } })
    if (path === '/api/post/feed') return route.fulfill({ json: { data: posts, meta: { nextCursor: null } } })
    const post = posts.find(item => path === `/api/post/${item.id}`)
    if (post) return route.fulfill({ json: { postData: {
      ...post, _id: post.id, body: JSON.stringify([{ type: 'paragraph', content: 'Notice the exact light on the window.' }]),
      seriesContext: post.id === ids[0] ? { id: 'series-one', title: 'A Practice of Attention', position: 0, total: 2, next: { id: ids[2] } } : null,
      depthContext: post.id === ids[0] ? { deeper: { id: ids[1], title: posts[1].title } } : null,
    } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return orders
}

for (const width of [320, 1280]) {
  test(`mixed collection format selection opens each short and restores focus at ${width}px`, async ({ page }) => {
    await mockWriting(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/collections/${collectionId}`)
    const articles = page.getByRole('region', { name: 'Full stories' })
    const shorts = page.getByRole('region', { name: 'Shorts' })
    await expect(articles.locator('[data-story-format="article"]')).toHaveCount(1)
    await expect(articles.getByRole('link', { name: posts[1].title, exact: true })).toHaveAttribute('href', `/post/${ids[1]}`)
    await page.getByRole('group', { name: 'Collection format' }).getByRole('button', { name: 'Shorts', exact: true }).click()
    await expect(shorts.locator('[data-story-format="short"]')).toHaveCount(2)
    await expect(articles).toHaveCount(0)
    const trigger = shorts.getByRole('link', { name: posts[0].title, exact: true })
    await trigger.click()
    const reader = page.getByRole('dialog', { name: posts[0].title })
    await expect(reader).toBeVisible()
    await expect(page).toHaveURL(`/collections/${collectionId}?collectionFormat=shorts`)
    await reader.getByRole('button', { name: 'Close short' }).click()
    await expect(trigger).toBeFocused()
    const other = shorts.getByRole('link', { name: posts[2].title, exact: true })
    await other.click()
    await expect(page.getByRole('dialog', { name: posts[2].title })).toBeVisible()
    await page.getByRole('button', { name: 'Close short' }).click()
    await expect(other).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
}

test('canonical short URLs use the compact reader and deeper articles retain the article page', async ({ page }) => {
  await mockWriting(page)
  await page.goto(`/post/${ids[0]}`)
  const reader = page.getByRole('dialog', { name: posts[0].title })
  await expect(reader).toBeVisible()
  await reader.getByRole('link', { name: 'Read full story →' }).click()
  await expect(page).toHaveURL(`/post/${ids[1]}`)
  await expect(page.getByRole('heading', { name: posts[1].title, level: 1 })).toBeVisible()
  await expect(page.getByRole('dialog', { name: posts[0].title })).toHaveCount(0)
  await page.goto(`/post/${ids[0]}`)
  await expect(page.getByRole('navigation', { name: 'Series progression' })).toHaveCount(0)
  await page.goto(`/post/${ids[2]}`)
  await expect(page).toHaveURL(`/post/${ids[2]}`)
  await expect(page.getByRole('dialog', { name: posts[2].title })).toBeVisible()
})

test('shorter shows only complete tags that fit one row', async ({ page }) => {
  await mockWriting(page)
  const tags = ['science', 'community', 'literature', 'a-long-topic-that-cannot-fit-on-a-phone']
  await page.route(`**/api/post/${ids[0]}`, route => route.fulfill({ json: { postData: {
    ...posts[0], _id: ids[0], body: JSON.stringify([{ type: 'paragraph', content: 'A short.' }]), tags,
  } } }))
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(`/post/${ids[0]}`)
  const row = page.getByLabel('Short tags')
  await expect(row).toBeVisible()
  await expect.poll(() => row.locator('a').count()).toBeGreaterThan(0)
  const layout = await row.evaluate(element => {
    const visible = [...element.children].filter(child => getComputedStyle(child).visibility !== 'hidden')
    const hidden = [...element.children].filter(child => getComputedStyle(child).visibility === 'hidden')
    const rowBox = element.getBoundingClientRect()
    return {
      visibleCount: visible.length,
      hiddenCount: hidden.length,
      visibleFit: visible.every(child => child.getBoundingClientRect().right <= rowBox.right + 1),
      singleLine: visible.every(child => Math.abs(child.getBoundingClientRect().top - visible[0].getBoundingClientRect().top) < 1),
      hiddenLinks: hidden.filter(child => child.querySelector('a')).length,
    }
  })
  expect(layout.visibleCount).toBeGreaterThan(0)
  expect(layout.hiddenCount).toBeGreaterThan(0)
  expect(layout.visibleFit).toBe(true)
  expect(layout.singleLine).toBe(true)
  expect(layout.hiddenLinks).toBe(0)
})

test('mixed collection editing removes only the selected short and preserves remaining reading order', async ({ page }) => {
  const orders = await mockWriting(page, true)
  await page.goto(`/collections/${collectionId}`)
  await page.getByRole('button', { name: 'Edit collection', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit collection', exact: true })
  await edit.getByRole('button', { name: `Remove ${posts[2].title} from collection`, exact: true }).click()
  await expect(edit.getByText(posts[0].title, { exact: true })).toBeVisible()
  await expect(edit.getByText(posts[1].title, { exact: true })).toBeVisible()
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect.poll(() => orders).toEqual([[ids[0], ids[1]]])
})

for (const path of ['/', '/search?q=morning&type=all']) {
  test('shared discovery cards respect format at ' + path, async ({ page }) => {
    await mockWriting(page)
    await page.goto(path)
    const short = page.locator('[data-story-format="short"]').filter({hasText: posts[0].title}).first()
    await expect(short).toBeVisible()
    await short.getByRole('link', {name:posts[0].title, exact:true}).click()
    await expect(page.getByRole('dialog', {name:posts[0].title})).toBeVisible()
    await expect(page).toHaveURL(path)
  })
}
