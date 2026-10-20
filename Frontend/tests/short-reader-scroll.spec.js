import { test, expect } from '@playwright/test'

const items = Array.from({ length: 4 }, (_, index) => ({
  id: `507f1f77bcf86cd79943909${index}`, format: 'short', title: `Reading card ${index + 1}`,
  author: { username: 'Maya Sen', handle: 'maya-sen' }, tags: ['science'],
  excerpt: 'A focused idea about noticing the world.', likesCount: 3, commentsCount: 15,
}))

async function settleCard(page) {
  await expect.poll(() => page.locator('[data-short-content]').evaluate(node => node.getAnimations().length)).toBe(0)
}

async function openReader(page, { width = 1280, long = false, delay = 0 } = {}) {
  await page.setViewportSize({ width, height: 844 })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: {} })
    if (path === '/api/post/shorts') return route.fulfill({ json: { data: items, meta: { nextCursor: null } } })
    const item = items.find(short => path === `/api/post/${short.id}`)
    if (item) {
      if (item.id !== items[0].id && delay) await new Promise(resolve => setTimeout(resolve, delay))
      return route.fulfill({ json: { postData: { ...item, _id: item.id, body: JSON.stringify([{ id: 'body', type: 'text', content: long ? 'Read all the text before moving to the next idea. '.repeat(100) : item.excerpt }]) } } })
    }
    if (path.endsWith('/comments')) return route.fulfill({ json: { data: Array.from({ length: 15 }, (_, i) => ({ id: `comment-${i}`, content: `Discussion ${i}. `.repeat(12), author: { username: 'Reader' }, createdAt: '2026-10-18T00:00:00Z' })), meta: {} } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/shorts')
  const opener = page.getByRole('link', { name: items[0].title, exact: true })
  await opener.click()
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  await settleCard(page)
  return opener
}

async function wheel(page, deltaY, { count = 1, gap = 20, deltaMode = 0, deltaX = 0, ctrlKey = false, target = '[data-short-scroll]' } = {}) {
  return page.locator(target).evaluate(async (node, options) => {
    const prevented = []
    for (let i = 0; i < options.count; i += 1) {
      // Re-query: navigation replaces the pane while the device is still sending momentum.
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: options.deltaY, deltaX: options.deltaX, deltaMode: options.deltaMode, ctrlKey: options.ctrlKey })
      document.querySelector(options.target).dispatchEvent(event)
      prevented.push(event.defaultPrevented)
      if (options.gap) await new Promise(resolve => setTimeout(resolve, options.gap))
    }
    return prevented
  }, { deltaY, count, gap, deltaMode, deltaX, ctrlKey, target })
}

test('continuous touchpad momentum never skips a second card', async ({ page }) => {
  await openReader(page)
  await wheel(page, 25, { count: 45, gap: 30 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  await expect.poll(() => page.locator('[data-short-scroll]').evaluate(node => node.scrollTop)).toBe(0)
  await page.waitForTimeout(350)
  await wheel(page, 25, { count: 5 })
  await expect(page.getByRole('dialog', { name: items[2].title })).toBeVisible()
})

test('native wheel is contained on replacement panes and supports backward navigation', async ({ page }) => {
  await openReader(page)
  await wheel(page, 60, { count: 2 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  await settleCard(page)
  const prevented = await wheel(page, -30, { count: 4 })
  expect(prevented.every(Boolean)).toBe(true)
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
})

test('content reaches its edge before a new gesture hands off without scrollend', async ({ page }) => {
  await openReader(page, { long: true })
  const pane = page.locator('[data-short-scroll]')
  await pane.hover()
  await page.mouse.wheel(0, 180)
  await expect.poll(() => pane.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await page.mouse.wheel(0, 9000)
  await expect.poll(() => pane.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 2)).toBe(true)
  await wheel(page, 20, { count: 12 })
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  await page.waitForTimeout(350)
  await wheel(page, 25, { count: 4 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
})

for (const width of [320, 390, 768, 1280]) {
  test(`reader geometry, incoming card and focus survive navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width >= 768 ? 'dark' : 'light')
    const opener = await openReader(page, { width })
    const frame = page.locator('[data-short-content]')
    const before = await frame.boundingBox()
    const background = await page.locator('#main-content').evaluate(node => node.scrollTop)
    await page.screenshot({ path: testInfo.outputPath(`reader-${width}.png`) })
    await wheel(page, 60, { count: 2, gap: 0 })
    await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
    const card = frame
    const entering = await card.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)
    expect(entering).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`incoming-${width}.png`) })
    await expect.poll(() => card.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(0)
    const after = await frame.boundingBox()
    expect(after).toEqual(before)
    expect(await page.locator('#main-content').evaluate(node => node.scrollTop)).toBe(background)
    const footer = await page.locator('dialog footer').boundingBox()
    expect(footer.y + footer.height).toBeLessThanOrEqual(after.y + after.height)
    expect(footer.y + footer.height).toBeGreaterThan(after.y + after.height - 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Close short' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
}

test('partial pushes settle, reverse safely, and respect first and last boundaries', async ({ page }) => {
  await openReader(page)
  await wheel(page, -100, { count: 5 })
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  const frame = page.locator('[data-short-content]')
  expect(await frame.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(0)
  await page.waitForTimeout(350)
  await wheel(page, 25, { count: 2 })
  expect(await frame.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(-50)
  await page.waitForTimeout(450)
  await expect.poll(() => frame.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(0)
  await wheel(page, 60)
  await wheel(page, -25)
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  for (let i = 1; i < items.length; i += 1) {
    await settleCard(page)
    await page.getByRole('button', { name: 'Next short', exact: true }).click()
    await expect(page.getByRole('dialog', { name: items[i].title })).toBeVisible()
  }
  await settleCard(page)
  await wheel(page, 120, { count: 10 })
  await expect(page.getByRole('dialog', { name: items[3].title })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next short' })).toBeDisabled()
  expect(await frame.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(0)
})

test('line/page wheels, horizontal swipes and pinch zoom preserve expected behavior', async ({ page }) => {
  await openReader(page)
  await wheel(page, 80, { deltaX: 150, count: 5 })
  await wheel(page, 100, { ctrlKey: true, count: 5 })
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  await wheel(page, 4, { deltaMode: 1, count: 2 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  await settleCard(page)
  await wheel(page, 1, { deltaMode: 2, count: 2 })
  await expect(page.getByRole('dialog', { name: items[2].title })).toBeVisible()
})

test('comments and share contain wheel input and retain the active short', async ({ page }) => {
  await openReader(page, { width: 390 })
  await page.getByRole('button', { name: 'Comments (15)' }).click()
  const comments = page.locator('[data-short-comments-scroll]')
  await expect(comments.getByText(/Discussion 14/)).toBeVisible()
  await comments.hover()
  await page.mouse.wheel(0, 400)
  await expect.poll(() => comments.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await wheel(page, 100, { count: 10, target: 'dialog' })
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Comments (15)' })).toBeFocused()
  await page.getByRole('button', { name: 'Share this short' }).click()
  await wheel(page, 100, { count: 10, target: '[data-short-scroll]' })
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Share this short' })).toBeFocused()
})

test('overlay wheel reads content first and then advances from its edge', async ({ page }) => {
  await openReader(page, { long: true })
  await page.mouse.move(12, 400)
  await page.mouse.wheel(0, 180)
  await expect.poll(() => page.locator('[data-short-scroll]').evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await page.mouse.wheel(0, 9000)
  await page.waitForTimeout(350)
  await page.mouse.wheel(0, 60)
  await page.mouse.wheel(0, 60)
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
})

test('delayed loading cannot consume another card from the same gesture', async ({ page }) => {
  await openReader(page, { delay: 800 })
  await wheel(page, 25, { count: 50, gap: 30 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  await expect(page.locator('[data-short-scroll]')).toHaveJSProperty('scrollTop', 0)
})

test('prefetches the next short and accepts a fresh gesture while detail is loading', async ({ page }) => {
  const requested = []
  page.on('request', request => requested.push(new URL(request.url()).pathname))
  await openReader(page, { delay: 3000 })
  await expect.poll(() => requested.filter(path => path === `/api/post/${items[1].id}`).length).toBe(1)

  await wheel(page, 60, { count: 2 })
  await expect(page.locator('dialog')).toHaveAttribute('aria-busy', 'true')
  await settleCard(page)
  await wheel(page, 60, { count: 2 })
  await expect.poll(() => requested.filter(path => path === `/api/post/${items[2].id}`).length).toBe(1)
  await expect(page.getByRole('dialog', { name: items[2].title })).toBeVisible()
})

test('reduced motion keeps navigation immediate and stationary', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openReader(page)
  await wheel(page, 60, { count: 2 })
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  expect(await page.locator('[data-short-content]').evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBe(0)
})

test('touch edge swipes cancel cleanly and work on replacement panes', async ({ page }) => {
  await openReader(page, { width: 390 })
  const swipe = async (deltaY, { horizontal = 0, cancel = false } = {}) => page.locator('[data-short-scroll]').evaluate((node, options) => {
    const start = new Touch({ identifier: 1, target: node, clientX: 150, clientY: 400 })
    const end = new Touch({ identifier: 1, target: node, clientX: 150 + options.horizontal, clientY: 400 - options.deltaY })
    node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }))
    const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [end] })
    node.dispatchEvent(move)
    node.dispatchEvent(new TouchEvent(options.cancel ? 'touchcancel' : 'touchend', { bubbles: true, changedTouches: [end] }))
    return move.defaultPrevented
  }, { deltaY, horizontal, cancel })
  expect(await swipe(140, { horizontal: 250 })).toBe(false)
  expect(await swipe(70, { cancel: true })).toBe(true)
  await page.waitForTimeout(200)
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
  expect(await swipe(120)).toBe(true)
  await expect(page.getByRole('dialog', { name: items[1].title })).toBeVisible()
  await settleCard(page)
  expect(await swipe(-120)).toBe(true)
  await expect(page.getByRole('dialog', { name: items[0].title })).toBeVisible()
})
