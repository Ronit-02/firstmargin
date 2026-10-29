import { test, expect } from './support/ui-test.js'

const post = {
  id: '507f1f77bcf86cd799439021', title: 'The Case for Slower Digital Mornings',
  abstract: 'A practical guide to making room for curiosity and thoughtful reading.',
  excerpt: 'A practical guide to making room for curiosity and thoughtful reading.',
  image: '/logo/logo-dark-profile.png', tags: ['science', 'travel', 'curiosity'],
  author: { username: 'Leila Noor', handle: 'leila-noor' },
  createdAt: '2026-09-08T00:00:00Z', readTime: '1 min read',
  likesCount: 30, commentsCount: 0, isLiked: false,
}

async function mockApi(page, { signedIn = true, failLike = false, article = post } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { accessToken: 'card-test-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } : { message: 'Signed out' } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: [article], writers: [], shorts: [article] } } })
    if (path === '/api/post/shorts' || path === '/api/post/feed') return route.fulfill({ json: { data: [article], meta: { nextCursor: null } } })
    if (path.endsWith('/like')) {
      const isLiked = route.request().method() === 'PUT'
      return route.fulfill({ status: failLike ? 500 : 200, json: failLike ? { message: 'Try again' } : { isLiked, likesCount: isLiked ? 31 : 30 } })
    }
    if (path.endsWith('/comments')) return route.fulfill({ json: route.request().method() === 'POST' ? { data: { id: 'comment-1', content: route.request().postDataJSON().text, author: { name: 'Reader' }, createdAt: '2026-10-06T00:00:00Z' } } : { data: [], meta: { nextCursor: null } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
}

test('Shorts reader follows the current filtered page list inside the modal', async ({ page }) => {
  const items = [
    { ...post, id: '507f1f77bcf86cd799439041', title: 'First science short', tags: ['science'], image: null },
    { ...post, id: '507f1f77bcf86cd799439042', title: 'Other topic short', tags: ['wellness'], image: null },
    { ...post, id: '507f1f77bcf86cd799439043', title: 'Second science short', tags: ['science'], image: null },
  ]
  await page.setViewportSize({ width: 320, height: 760 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: items, meta: { nextCursor: null } } })
    const item = items.find(short => path === `/api/post/${short.id}`)
    if (item) return route.fulfill({ json: { postData: { ...item, _id: item.id, body: JSON.stringify(Array.from({ length: item.id === items[0].id ? 20 : 1 }, (_, index) => ({ id: `text-${index}`, type: 'text', content: item.excerpt }))) } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/shorts?shortTopic=science')
  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(2)
  const opener = cards.first().getByRole('link', { name: items[0].title })
  await opener.click()
  let reader = page.getByRole('dialog', { name: items[0].title })
  await expect(reader.getByRole('group', { name: 'Browse shorts' })).toBeHidden()
  await expect(reader).not.toContainText('1 of 2')
  const pane = reader.locator('[data-short-scroll]')
  await pane.hover()
  await page.mouse.wheel(0, 180)
  await expect(reader).toBeVisible()
  expect(await pane.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await page.mouse.wheel(0, 3000)
  await expect(reader).toBeVisible()
  expect(await pane.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 2)).toBe(true)
  await pane.evaluate(node => {
    node.scrollTop = node.scrollHeight - node.clientHeight - 40
    node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 20 }))
    node.scrollTop = node.scrollHeight
    for (let index = 0; index < 2; index += 1) node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 20 }))
  })
  await expect(reader).toBeVisible()
  await page.mouse.wheel(0, 180)
  await expect(reader).toBeVisible()
  await page.mouse.wheel(0, 180)
  await expect(reader).toBeVisible()
  await page.waitForTimeout(350)
  await pane.evaluate(node => {
    for (let index = 0; index < 3; index += 1) node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 180 }))
  })
  reader = page.getByRole('dialog', { name: items[2].title })
  await expect(reader).toBeVisible()
  await expect(reader).not.toContainText('2 of 2')
  await expect(page).toHaveURL('/shorts?shortTopic=science')
  await page.waitForTimeout(950)
  await reader.locator('[data-short-scroll]').evaluate(node => {
    node.scrollTop = 0
    const start = new Touch({ identifier: 1, target: node, clientX: 160, clientY: 230 })
    const end = new Touch({ identifier: 1, target: node, clientX: 158, clientY: 340 })
    node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }))
    node.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }))
  })
  reader = page.getByRole('dialog', { name: items[0].title })
  await expect(reader).toBeVisible()
  await reader.getByRole('button', { name: 'Close short' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  reader = page.getByRole('dialog', { name: items[0].title })
  await expect.poll(() => reader.locator('[data-short-content]').evaluate(node => node.getAnimations().length)).toBe(0)
  const smallTouchOffset = await reader.locator('[data-short-scroll]').evaluate(node => {
    node.scrollTop = node.scrollHeight
    const smallStart = new Touch({ identifier: 1, target: node, clientX: 160, clientY: 340 })
    const smallEnd = new Touch({ identifier: 1, target: node, clientX: 158, clientY: 260 })
    node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [smallStart] }))
    node.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [smallEnd] }))
    const offset = new DOMMatrixReadOnly(getComputedStyle(node.closest('[data-short-content]')).transform).m42
    node.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [smallEnd] }))
    return offset
  })
  expect(smallTouchOffset).toBe(-80)
  await expect(reader).toBeVisible()
  await reader.locator('[data-short-scroll]').evaluate(node => {
    const start = new Touch({ identifier: 1, target: node, clientX: 160, clientY: 340 })
    const end = new Touch({ identifier: 1, target: node, clientX: 158, clientY: 230 })
    node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }))
    node.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }))
  })
  await expect(page.getByRole('dialog', { name: items[2].title })).toBeVisible()
  const shortTag = page.getByRole('dialog', { name: items[2].title }).getByRole('link', { name: 'science' })
  await expect(shortTag).toHaveAttribute('href', '/search?q=science&type=shorts')
  await shortTag.click()
  await expect(page).toHaveURL('/search?q=science&type=shorts')
  await expect(page.getByRole('tab', { name: 'Shorts' })).toHaveAttribute('aria-selected', 'true')
})

test('shorter keeps stable dimensions and uses external desktop navigation', async ({ page }) => {
  const items = [
    { ...post, id: '507f1f77bcf86cd799439051', title: 'Long desktop short', image: null },
    { ...post, id: '507f1f77bcf86cd799439052', title: 'Brief desktop short', image: null },
  ]
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: items, meta: { nextCursor: null } } })
    const item = items.find(short => path === `/api/post/${short.id}`)
    if (item) return route.fulfill({ json: { postData: { ...item, _id: item.id, body: JSON.stringify([{ id: 'text', type: 'text', content: item.id === items[0].id ? item.excerpt : 'Brief content.' }]) } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/shorts')
  await page.getByRole('article').first().getByRole('link', { name: items[0].title }).click()
  let reader = page.getByRole('dialog', { name: items[0].title })
  await expect.poll(() => reader.locator('[data-short-content]').evaluate(node => node.getAnimations().length)).toBe(0)
  const readerFrame = reader.locator(':scope > div > section')
  const initialBox = await readerFrame.boundingBox()
  const initialLayout = await reader.locator('footer').evaluate(footer => {
    const frame = footer.closest('section')
    return { footerBottom: footer.getBoundingClientRect().bottom, frameBottom: frame.getBoundingClientRect().bottom }
  })
  expect(Math.abs(initialLayout.footerBottom - initialLayout.frameBottom)).toBeLessThanOrEqual(2)
  const browse = reader.getByRole('group', { name: 'Browse shorts' })
  await expect(browse).toBeVisible()
  await expect(browse.getByRole('button', { name: 'Previous short' })).toBeDisabled()
  await browse.getByRole('button', { name: 'Next short' }).click()
  reader = page.getByRole('dialog', { name: items[1].title })
  await expect(reader).toBeVisible()
  const nextBox = await reader.locator(':scope > div > section').boundingBox()
  expect(nextBox.height).toBeCloseTo(initialBox.height, 1)
  expect(nextBox.width).toBeCloseTo(initialBox.width, 1)
  await expect(reader.getByRole('button', { name: 'Previous short' })).toBeEnabled()
  await expect(reader).not.toContainText(/\d+ of \d+/)
})

test('wheel navigation outside the short modal changes the active short', async ({ page }) => {
  const items = [
    { ...post, id: '507f1f77bcf86cd799439061', title: 'Overlay first short', image: null },
    { ...post, id: '507f1f77bcf86cd799439062', title: 'Overlay next short', image: null },
  ]
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: items, meta: { nextCursor: null } } })
    const item = items.find(short => path === `/api/post/${short.id}`)
    if (item) return route.fulfill({ json: { postData: { ...item, _id: item.id, body: JSON.stringify([{ type: 'text', content: 'Overlay navigation content.' }]) } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/shorts')
  await page.getByRole('article').first().getByRole('link', { name: items[0].title }).click()
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  // Dispatch one continuous gesture on the backdrop without round trips that
  // can exceed the reader's gesture gap on a busy test host.
  const contained = await page.getByRole('dialog', { name: items[0].title }).evaluate(dialog => {
    return Array.from({ length: 3 }, () => {
      const event = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })
      dialog.dispatchEvent(event)
      return event.defaultPrevented
    })
  })
  expect(contained).toEqual([true, true, true])
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
})

test('scrolling expanded short comments does not navigate to another short', async ({ page }) => {
  const items = [
    { ...post, id: '507f1f77bcf86cd799439071', title: 'Commented first short', image: null, commentsCount: 12 },
    { ...post, id: '507f1f77bcf86cd799439072', title: 'Commented next short', image: null, commentsCount: 0 },
  ]
  const comments = Array.from({ length: 12 }, (_, index) => ({
    id: `comment-${index}`,
    content: `Scrollable comment ${index + 1}. This stays inside the discussion pane.`,
    createdAt: '2026-10-06T00:00:00Z',
    author: { name: `Reader ${index + 1}` },
    likesCount: 0,
    isLiked: false,
    repliesCount: 0,
  }))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: items, meta: { nextCursor: null } } })
    if (path === `/api/post/${items[0].id}/comments`) return route.fulfill({ json: { data: comments, meta: { nextCursor: null, totalCount: comments.length } } })
    const item = items.find(short => path === `/api/post/${short.id}`)
    if (item) return route.fulfill({ json: { postData: { ...item, _id: item.id, body: JSON.stringify(Array.from({ length: 18 }, (_, index) => ({ id: `text-${index}`, type: 'text', content: item.excerpt }))) } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/shorts')
  await page.getByRole('article').first().getByRole('link', { name: items[0].title }).click()
  const reader = page.getByRole('dialog', { name: items[0].title })
  const readingPane = reader.locator('[data-short-scroll]')
  await readingPane.evaluate(node => { node.scrollTop = 140 })
  const readingPosition = await readingPane.evaluate(node => node.scrollTop)
  await reader.getByRole('button', { name: 'Comments (12)' }).click()
  expect(Math.abs(await readingPane.evaluate(node => node.scrollTop) - readingPosition)).toBeLessThanOrEqual(1)
  await expect(reader.getByRole('button', { name: 'Close comments', exact: true })).toBeFocused()
  await expect(reader.locator('[data-short-comments-overlay]')).toBeVisible()
  await expect(reader.getByText('Scrollable comment 12. This stays inside the discussion pane.')).toBeVisible()
  const commentsPane = reader.locator('[data-short-comments-scroll]')
  await expect.poll(() => commentsPane.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  await commentsPane.hover()
  await page.mouse.wheel(0, 220)
  await expect.poll(() => commentsPane.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await expect(reader).toBeVisible()
  await expect(page.getByRole('dialog', { name: items[1].title })).toHaveCount(0)
  await reader.getByRole('button', { name: 'Close comments', exact: true }).click()
  await expect(reader.locator('[data-short-comments-overlay]')).toHaveCount(0)
  expect(Math.abs(await readingPane.evaluate(node => node.scrollTop) - readingPosition)).toBeLessThanOrEqual(1)
  await expect(reader.getByRole('button', { name: 'Comments (12)' })).toBeFocused()
  await reader.getByRole('button', { name: 'Comments (12)' }).click()
  await reader.getByRole('button', { name: 'Close comments and return to short' }).click({ position: { x: 8, y: 8 } })
  await expect(reader.locator('[data-short-comments-overlay]')).toHaveCount(0)
  await expect(reader).toBeVisible()
})

for (const width of [320, 1280]) {
  test(`short detail author and share options work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await mockApi(page)
    await page.route(`**/api/post/${post.id}`, route => route.fulfill({ json: { postData: { ...post, _id: post.id, body: JSON.stringify([{ id: 'text', type: 'text', content: post.excerpt }]) } } }))
    await page.addInitScript(() => {
      window.__copiedLink = null
      window.__sharedWindow = null
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedLink = value } } })
      window.open = (...args) => { window.__sharedWindow = args; return null }
    })
    await page.goto('/shorts')
    const openShort = () => page.getByRole('article').first().getByRole('link', { name: post.title, exact: true }).click()
    await openShort()
    const reader = page.getByRole('dialog', { name: post.title, exact: true })
    await expect(reader.getByRole('button', { name: /^View .* comments$/ })).toHaveCount(0)
    await expect(reader.getByRole('button', { name: 'Comments (0)' })).toBeVisible()
    await reader.getByText(post.readTime, { exact: true }).click()
    await expect(page).toHaveURL('/shorts')
    await expect(reader).toBeVisible()
    expect(await reader.getByText(post.readTime, { exact: true }).evaluate(node => node.closest('a'))).toBeNull()
    const share = reader.getByRole('button', { name: 'Share this short' })
    await share.click()
    const options = page.getByRole('dialog', { name: 'Share short', exact: true })
    const copy = options.getByRole('button', { name: 'Copy Link', exact: true })
    await expect(copy).toBeFocused()
    await options.screenshot({ path: testInfo.outputPath(`share-${width}.png`) })
    await expect.poll(() => page.evaluate(() => window.__copiedLink)).toBe(null)
    await copy.press('Tab')
    await expect(options.getByRole('button', { name: 'Share on X' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(options).toHaveCount(0)
    await expect(share).toBeFocused()
    await expect(reader).toBeVisible()
    await share.click()
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable') } })
    await copy.click()
    await expect(options).toBeVisible()
    await expect(page.getByText('The short link could not be copied.', { exact: true })).toBeVisible()
    await page.evaluate(() => { navigator.clipboard.writeText = async value => { window.__copiedLink = value } })
    await copy.press('Escape')
    await share.click()
    await copy.click()
    await expect.poll(() => page.evaluate(() => window.__copiedLink)).toBe(`${new URL(page.url()).origin}/post/${post.id}`)
    await expect(share).toBeFocused()
    await share.click()
    await options.getByRole('button', { name: 'Share on X' }).click()
    await expect.poll(() => page.evaluate(() => window.__sharedWindow)).toEqual([`https://x.com/intent/tweet?url=${encodeURIComponent(`${new URL(page.url()).origin}/post/${post.id}`)}`, '_blank', 'noopener,noreferrer'])
    await expect(options).toHaveCount(0)
    await reader.getByRole('link', { name: "View Leila Noor's profile" }).click()
    await expect(page).toHaveURL('/author/leila-noor')
    await expect(reader).toHaveCount(0)
  })
}

for (const width of [320, 390, 1280]) {
  for (const image of [post.image, null]) {
    test(`post card click destinations remain independent at ${width}px (${image ? 'cover' : 'text only'})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockApi(page, { article: { ...post, image } })
      const origin = '/search?q=mornings'
      const card = page.getByRole('article').first()
      const clickArea = async locator => {
        await locator.scrollIntoViewIfNeeded()
        const box = await locator.boundingBox()
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      }
      for (const target of [
        () => card.getByRole('link', { name: "View Leila Noor's profile" }),
      ]) {
        await page.goto(origin)
        await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
        await clickArea(target())
        await expect(page).toHaveURL('/author/leila-noor')
      }
      for (const label of width < 540 ? ['8 Sept 26', '1 min'] : ['8 September 2026', post.readTime]) {
        await page.goto(origin)
        const metadata = card.getByText(label, { exact: true })
        await expect(metadata).toBeVisible()
        expect(await metadata.evaluate(node => node.closest('a'))).toBeNull()
        await clickArea(metadata)
        await expect(page).toHaveURL(origin)
      }
      await page.goto(origin)
      const category = card.getByRole('link', { name: 'science', exact: true })
      await expect(category).toHaveAttribute('href', '/search?q=science')
      const searchRequest = page.waitForRequest(request => {
        const url = new URL(request.url())
        return url.pathname === '/api/search' && url.searchParams.get('q') === 'science' && url.searchParams.get('type') === 'posts'
      })
      await category.click()
      await searchRequest
      await expect(page).toHaveURL(/\/search\?q=science$/)
      for (const target of [
        ...(width >= 540 ? [() => card.getByText(post.excerpt, { exact: true })] : []),
        () => card.getByRole('heading', { name: post.title }),
        ...(image ? [() => card.getByRole('link', { name: `Read ${post.title}`, exact: true })] : []),
      ]) {
        await page.goto(origin)
        await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
        await clickArea(target())
        await expect(page).toHaveURL(`/post/${post.id}`)
      }
      await page.goto(origin)
      await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
      await card.scrollIntoViewIfNeeded()
      const box = await card.boundingBox()
      await page.mouse.click(box.x + box.width - 3, box.y + box.height - 3)
      await expect(page).toHaveURL(`/post/${post.id}`)
      await page.goto(origin)
      const titleLink = card.getByRole('link', { name: post.title, exact: true })
      await titleLink.focus()
      await titleLink.press('Enter')
      await expect(page).toHaveURL(`/post/${post.id}`)
    })
  }
}

test('image-bearing list cards switch to a compact side cover at 540px', async ({ page }) => {
  const responsivePost = {
    ...post,
    title: 'The Case for Slower Digital Mornings and the Many Small Changes That Make Reading Better Every Day',
    excerpt: 'A practical guide to making room for curiosity and thoughtful reading, with enough detail to check that the description is hidden only on smaller screens.',
  }
  await mockApi(page, { signedIn: false, article: responsivePost })
  for (const width of [320, 390, 539, 540, 600, 639, 640, 768, 900, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/search?q=mornings')
    const card = page.getByRole('article').first()
    const heading = card.getByRole('heading', { name: responsivePost.title })
    const cover = card.getByRole('link', { name: `Read ${responsivePost.title}`, exact: true })
    const author = card.getByRole('link', { name: 'View Leila Noor\'s profile' })
    const date = card.getByText('8 September 2026', { exact: true })
    const compactDate = card.getByText('8 Sept 26', { exact: true })
    const compactReadTime = card.getByText('1 min', { exact: true })
    const description = card.getByText(responsivePost.excerpt, { exact: true })
    await expect(heading).toBeVisible()
    const cardBox = await card.boundingBox()
    const headingBox = await heading.boundingBox()
    const coverBox = await cover.boundingBox()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width < 540) {
      const authorBox = await author.boundingBox()
      const authorRowBox = await author.locator('..').locator('..').boundingBox()
      const dateBox = await compactDate.boundingBox()
      const readTimeBox = await compactReadTime.boundingBox()
      await expect(date).toBeHidden()
      await expect(description).toBeHidden()
      await expect(author.locator('span').last()).toHaveCSS('color', await compactDate.evaluate(element => getComputedStyle(element).color))
      expect(coverBox.y + coverBox.height).toBeLessThan(authorBox.y)
      expect(dateBox.x).toBeGreaterThan(authorBox.x + authorBox.width)
      expect(dateBox.x - (authorBox.x + authorBox.width)).toBeLessThan(24)
      expect(await compactDate.locator('..').locator('span').allTextContents()).toEqual(['·', '8 Sept 26', '·', '1 min'])
      expect(Math.abs(dateBox.y - authorBox.y)).toBeLessThan(10)
      expect(readTimeBox.x).toBeGreaterThan(dateBox.x + dateBox.width)
      expect(dateBox.y + dateBox.height).toBeLessThan(headingBox.y)
      expect(headingBox.y - (authorRowBox.y + authorRowBox.height)).toBeLessThan(12)
      expect(headingBox.y - (authorBox.y + authorBox.height)).toBeLessThan(20)
      const menuBox = await card.getByRole('button', { name: `More options for ${responsivePost.title}` }).boundingBox()
      expect(menuBox.height).toBeGreaterThanOrEqual(44)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(headingBox.y)
      expect(coverBox.width).toBeGreaterThan(cardBox.width * 0.9)
      expect(coverBox.width / coverBox.height).toBeLessThan(2.1)
      const titleLines = await heading.evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))
      expect(titleLines).toBeLessThanOrEqual(2.05)
    } else {
      await expect(date).toBeVisible()
      await expect(description).toBeVisible()
      expect(coverBox.x).toBeGreaterThan(headingBox.x + headingBox.width)
      expect(coverBox.width).toBeLessThanOrEqual(width < 1024 ? 201 : 241)
      expect(coverBox.height).toBe(140)
    }
  }
})

test('coverless list cards keep metadata before the title and footer after the excerpt', async ({ page }) => {
  await mockApi(page, { signedIn: false, article: { ...post, image: null } })
  for (const width of [390, 767, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/search?q=mornings')
    const card = page.getByRole('article').first()
    const heading = card.getByRole('heading', { name: post.title })
    const author = card.getByRole('link', { name: "View Leila Noor's profile" })
    const footer = card.getByRole('button', { name: `Appreciate ${post.title}` })
    const authorBox = await author.boundingBox()
    const headingBox = await heading.boundingBox()
    const footerBox = await footer.boundingBox()
    expect(authorBox.y + authorBox.height).toBeLessThan(headingBox.y)
    expect(headingBox.y + headingBox.height).toBeLessThan(footerBox.y)
    if (width >= 540) {
      const excerptBox = await card.getByText(post.excerpt, { exact: true }).boundingBox()
      expect(headingBox.y + headingBox.height).toBeLessThan(excerptBox.y)
      expect(excerptBox.y + excerptBox.height).toBeLessThan(footerBox.y)
    }
  }
})

test('covered and coverless list cards keep the same mobile title spacing', async ({ page }) => {
  for (const width of [390, 539, 540, 767]) {
    await page.setViewportSize({ width, height: 900 })
    const gaps = []
    for (const image of [post.image, null]) {
      await mockApi(page, { signedIn: false, article: { ...post, image } })
      await page.goto('/search?q=mornings')
      const card = page.getByRole('article').first()
      const menu = card.getByRole('button', { name: `More options for ${post.title}` })
      const rowBox = await menu.evaluate(node => node.closest('article').querySelector('h2').previousElementSibling.getBoundingClientRect().toJSON())
      const headingBox = await card.getByRole('heading', { name: post.title }).boundingBox()
      gaps.push(headingBox.y - (rowBox.y + rowBox.height))
    }
    expect(gaps[0]).toBeCloseTo(gaps[1], 0)
    expect(gaps[0]).toBeCloseTo(width < 540 ? 8 : 20, 0)
  }
})

test('grid author links and remaining card area keep distinct destinations', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "Writer's picks", exact: true }) }).last()
  await section.scrollIntoViewIfNeeded()
  await section.getByText(post.readTime, { exact: true }).click()
  await expect(page).toHaveURL('/')
  await section.getByRole('link', { name: "View Leila Noor's profile" }).click()
  await expect(page).toHaveURL('/author/leila-noor')
  await page.goto('/')
  const card = section.getByRole('article').first()
  await card.scrollIntoViewIfNeeded()
  const box = await card.boundingBox()
  await page.mouse.click(box.x + 3, box.y + box.height - 3)
  await expect(page).toHaveURL(`/post/${post.id}`)
})

test('short-card category and background preserve search and modal destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await mockApi(page)
  await page.route(`**/api/post/${post.id}`, route => route.fulfill({ json: { postData: { ...post, _id: post.id, body: JSON.stringify([{ id: 'text', type: 'text', content: post.excerpt }]) } } }))
  await page.goto('/shorts')
  const card = page.getByRole('article').first()
  const searchRequest = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname === '/api/search' && url.searchParams.get('q') === 'science' && url.searchParams.get('type') === 'shorts'
  })
  await expect(card.getByText('science', { exact: true })).toBeVisible()
  await expect(card.getByRole('link', { name: 'science', exact: true })).toHaveCount(0)
  await card.getByRole('link', { name: post.title, exact: true }).click()
  await page.getByRole('dialog', { name: post.title, exact: true }).getByRole('link', { name: 'science', exact: true }).click()
  await searchRequest
  await expect(page).toHaveURL('/search?q=science&type=shorts')
  await expect(page.getByRole('tab', { name: 'Shorts', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
  await page.goto('/shorts')
  await card.getByText(post.excerpt, { exact: true }).scrollIntoViewIfNeeded()
  const excerpt = await card.getByText(post.excerpt, { exact: true }).boundingBox()
  await page.mouse.click(excerpt.x + excerpt.width / 2, excerpt.y + excerpt.height / 2)
  await expect(page.getByRole('dialog', { name: post.title, exact: true })).toBeVisible()
  await expect(page).toHaveURL('/shorts')
  await page.getByRole('button', { name: 'Close short' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const width of [320, 390, 1280]) {
  test(`short cards fit their content at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      if (!localStorage.getItem('ink-theme')) localStorage.setItem('ink-theme', 'light')
    })
    await mockApi(page, { article: { ...post, image: null } })
    await page.goto('/shorts')
    const card = page.getByRole('article').first()
    await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
    const assertSpacing = async () => {
      const heading = card.getByRole('heading', { name: post.title, exact: true })
      await expect(heading).toHaveCSS('-webkit-line-clamp', '2')
      const bounds = await card.boundingBox()
      expect(bounds.height).toBeGreaterThanOrEqual(270)
      expect(await card.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false)
      for (const control of await card.getByRole('button').all()) {
        const box = await control.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(bounds.x)
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height)
      }
    }
    await assertSpacing()
    await card.screenshot({ path: testInfo.outputPath(`short-${width}-light.png`) })
    await page.evaluate(() => { localStorage.setItem('ink-theme', 'dark') })
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(card.getByRole('heading', { name: post.title })).toBeVisible()
    await assertSpacing()
    await card.screenshot({ path: testInfo.outputPath(`short-${width}-dark.png`) })
    const originalHeight = (await card.boundingBox()).height
    const longTitle = 'A longer short title that remains readable as it wraps. '.repeat(5).trim()
    await mockApi(page, { article: { ...post, title: longTitle, image: null } })
    await page.reload()
    const heading = card.getByRole('heading', { name: longTitle, exact: true })
    await expect(heading).toBeVisible()
    expect((await card.boundingBox()).height).toBe(originalHeight)
    await expect(heading).toHaveCSS('-webkit-line-clamp', '2')
    expect((await card.boundingBox()).width).toBeLessThanOrEqual(320)
  })
}

for (const width of [320, 350, 390, 767, 768, 1280]) {
  test(`card actions, comment modal, and menu fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockApi(page)
    await page.goto('/search?q=mornings')
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: post.title, exact: true }) }).first()
    const like = card.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })
    const comments = card.getByRole('button', { name: `Comments on ${post.title}` })
    await expect(like).toHaveText('30')
    await expect(comments).toHaveText('0')
    const assertBounds = async () => {
      for (const element of [card, like, comments, ...await card.locator('a[href^="/search?q="]').all()]) {
        const box = await element.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await assertBounds()
    const metadata = await card.getByText(width < 540 ? '8 Sept 26' : '8 September 2026', { exact: true }).boundingBox()
    const heading = await card.getByRole('heading', { name: post.title, exact: true }).boundingBox()
    expect(heading.y - metadata.y - metadata.height).toBeGreaterThanOrEqual(width < 540 ? 7 : 19)
    await expect(like).toHaveCSS('border-top-width', '1px')
    await expect(comments).toHaveCSS('border-top-width', '1px')
    if (width < 540) {
      const cover = await card.getByRole('link', { name: `Read ${post.title}`, exact: true }).boundingBox()
      await expect(card.getByText(post.excerpt, { exact: true })).toBeHidden()
      const tags = card.locator('a[href^="/search?q="]')
      expect(cover.y + cover.height).toBeLessThanOrEqual(heading.y)
      expect((await like.boundingBox()).y).toBeGreaterThanOrEqual(cover.y + cover.height + 11)
      for (const tag of await tags.all()) {
        const box = await tag.boundingBox()
        expect(box.x + box.width).toBeLessThanOrEqual((await like.boundingBox()).x - 8)
      }
    }
    if (width === 350) await card.screenshot({ path: 'test-results/discovery-card-mobile.png' })
    await like.click()
    const unlike = card.getByRole('button', { name: `Remove appreciation from ${post.title}` })
    await expect(unlike).toHaveAttribute('aria-pressed', 'true')
    await expect(unlike).toHaveText('31')
    await unlike.click()
    await expect(like).toHaveText('30')
    const before = await card.boundingBox()
    await comments.click()
    const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close comments' })).toBeFocused()
    await expect(card.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0)
    expect((await card.boundingBox()).height).toBe(before.height)
    await expect(comments).toHaveAttribute('aria-expanded', 'true')
    await dialog.getByRole('textbox', { name: 'Add a comment' }).fill('A thoughtful morning read.')
    await assertBounds()
    await dialog.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(dialog.getByText('A thoughtful morning read.', { exact: true })).toBeVisible()
    await expect(comments).toHaveText('1')
    await page.keyboard.press('Escape')
    await expect(comments).toBeFocused()
    await expect(card.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0)
    const trigger = card.getByRole('button', { name: `More options for ${post.title}` })
    await trigger.click()
    const menu = page.getByRole('menu', { name: `Options for ${post.title}` })
    await expect(menu.getByRole('menuitem', { name: 'Appreciate story' })).toHaveCount(0)
    for (const item of await menu.getByRole('menuitem').all()) await expect(item.locator('svg')).toHaveCount(1)
    await expect(menu.getByRole('menuitem', { name: 'Save story' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })
}

test('article categories show only complete pills beside engagement controls as width changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await mockApi(page)
  await page.goto('/search?q=mornings')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: post.title, exact: true }) }).first()
  const categoryLinks = card.locator('a[href^="/search?q="]')
  const comments = card.getByRole('button', { name: `Comments on ${post.title}` })
  await expect.poll(() => categoryLinks.count()).toBeLessThan(3)
  await expect(categoryLinks.first()).toBeVisible()
  const assertFits = async () => {
    const controls = await comments.boundingBox()
    for (const category of await categoryLinks.all()) {
      const box = await category.boundingBox()
      expect(box.x + box.width).toBeLessThanOrEqual(controls.x - 8)
    }
    const positions = await categoryLinks.evaluateAll(links => links.map(link => link.getBoundingClientRect().top))
    expect(new Set(positions.map(Math.round)).size).toBeLessThanOrEqual(1)
  }
  await assertFits()
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect(categoryLinks).toHaveCount(3)
  await assertFits()
  await page.setViewportSize({ width: 320, height: 844 })
  await expect.poll(() => categoryLinks.count()).toBeLessThan(3)
  await assertFits()
})

test('failed appreciation restores count and pressed state', async ({ page }) => {
  await mockApi(page, { failLike: true })
  await page.goto('/search?q=mornings')
  const like = page.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })
  await like.click()
  await expect(page.getByText('The appreciation could not be updated.')).toBeVisible()
  await expect(like).toHaveText('30')
  await expect(like).toHaveAttribute('aria-pressed', 'false')
})

test('guest card actions preserve sign-in and public comment access', async ({ page }) => {
  await mockApi(page, { signedIn: false })
  await page.goto('/search?q=mornings')
  await page.getByRole('button', { name: `Comments on ${post.title}` }).click()
  await expect(page.getByText('Sign in to join the conversation.')).toBeVisible()
  await page.getByRole('button', { name: 'Close comments' }).click()
  await page.getByRole('button', { name: `Appreciate ${post.title}`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
})

test('short-card actions do not open the reading modal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await mockApi(page)
  await page.goto('/shorts')
  await page.getByRole('button', { name: `Comments on ${post.title}` }).click()
  await expect(page.getByRole('textbox', { name: 'Add a comment' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Comments', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Add a comment' }).fill('Short and useful.')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('Short and useful.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('grid cards expose direct actions and distinct comment modals', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('heading', { name: "Writer's picks", exact: true }).scrollIntoViewIfNeeded()
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "Writer's picks", exact: true }) }).last()
  const comments = section.getByRole('button', { name: `Comments on ${post.title}` })
  await comments.click()
  await expect(page.getByRole('dialog', { name: 'Comments', exact: true }).getByRole('textbox', { name: 'Add a comment' })).toBeVisible()
  await expect(section.getByRole('button', { name: `Appreciate ${post.title}`, exact: true })).toBeVisible()
  const panelId = await comments.getAttribute('aria-controls')
  expect(await page.evaluate(id => [...document.querySelectorAll('[id]')].filter(node => node.id === id).length, panelId)).toBe(1)
})

test('coverless grid stories keep the shared cover and card heights', async ({ page }) => {
  await mockApi(page, { article: { ...post, image: null } })
  await page.goto('/')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "Writer's picks", exact: true }) }).last()
  const card = section.getByRole('article').first()
  await expect(card.getByRole('img', { name: 'Text-only story' })).toBeVisible()
  await expect(card.getByText('Text-only story', { exact: true })).toHaveCount(0)
  const dimensions = await card.evaluate(element => ({
    cardHeight: element.getBoundingClientRect().height,
    coverHeight: element.lastElementChild.getBoundingClientRect().height,
  }))
  expect(dimensions.cardHeight).toBe(400)
  expect(dimensions.coverHeight).toBe(180)
})

test('long mobile metadata and expanded menu fit in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await mockApi(page)
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await page.route('**/api/search?**', route => route.fulfill({ json: { data: { posts: [{ ...post, title: 'Mornings'.repeat(12), tags: ['curiosity'.repeat(12)], author: { ...post.author, username: 'Leila'.repeat(20) } }], writers: [], shorts: [] } } }))
  await page.goto('/search?q=mornings')
  await expect(page.locator('html')).toHaveClass(/dark/)
  const card = page.getByRole('article').first()
  await card.getByRole('button', { name: /More options/ }).click()
  await page.getByRole('menu', { name: `Options for ${'Mornings'.repeat(12)}` }).getByRole('menuitem', { name: 'Why you’re seeing this' }).click()
  const menu = page.getByRole('menu', { name: `Options for ${'Mornings'.repeat(12)}` })
  const box = await menu.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/discovery-card-dark-menu.png' })
})

for (const size of [{ width: 320, height: 420 }, { width: 1280, height: 720 }]) {
  test(`comment modal scrolls through all pages and contains focus at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size)
    await mockApi(page)
    await page.route('**/api/post/*/comments**', route => {
      const next = new URL(route.request().url()).searchParams.has('cursor')
      return route.fulfill({ json: { data: Array.from({ length: next ? 1 : 12 }, (_, i) => ({ id: `${next}-${i}`, content: next ? 'Last comment in the thread' : `Existing comment ${i + 1}`, author: { name: 'Reader' }, createdAt: '2026-10-06T00:00:00Z' })), meta: { nextCursor: next ? null : 'next-page' } } })
    })
    await page.goto('/search?q=mornings')
    const trigger = page.getByRole('button', { name: `Comments on ${post.title}` })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
    const panel = await dialog.locator('section').first().boundingBox()
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.width).toBeLessThanOrEqual(size.width)
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.y + panel.height).toBeLessThanOrEqual(size.height)
    const close = dialog.getByRole('button', { name: 'Close comments' })
    await expect(close).toBeFocused()
    await dialog.locator('.overflow-y-auto').last().evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(dialog.getByText('Last comment in the thread')).toBeVisible()
    await close.scrollIntoViewIfNeeded()
    if (size.width === 320) await page.screenshot({ path: 'test-results/comments-modal-mobile.png' })
    await close.click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await dialog.click({ position: { x: 2, y: 2 } })
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}
