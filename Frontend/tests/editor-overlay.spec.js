import { test, expect } from '@playwright/test'

test('phone block types appear in a horizontal strip and convert the focused block', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-phone-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await paragraph.fill('A first line')
  const choices = page.getByRole('toolbar', { name: 'Block types' })
  await expect(choices).toBeVisible()
  await expect(choices.getByRole('button')).toHaveCount(7)
  await expect(choices.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true')
  expect(await choices.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const buttons = [...element.querySelectorAll('button')]
    return rect.bottom <= window.visualViewport.offsetTop + window.visualViewport.height
      && element.scrollWidth > element.clientWidth
      && buttons.every(button => Math.abs(button.getBoundingClientRect().top - buttons[0].getBoundingClientRect().top) < 1)
  })).toBe(true)
  await choices.getByRole('button', { name: 'Heading 2' }).click()
  const heading = page.getByRole('textbox', { name: 'h2 block', exact: true })
  await expect(heading).toHaveValue('A first line')
  await expect(heading).toBeFocused()
  await expect(choices.getByRole('button', { name: 'Heading 2' })).toHaveAttribute('aria-pressed', 'true')
  await choices.evaluate(element => { element.scrollLeft = element.scrollWidth })
  await expect(choices.getByRole('button', { name: 'Image URL' })).toBeInViewport()
  await page.getByRole('textbox', { name: 'Story title' }).focus()
  await expect(choices).toHaveCount(0)
})

for (const width of [767, 768, 1024]) {
  test(`plus insert control uses the appropriate menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-insert-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/studio?new=article')
    const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await paragraph.fill('Original paragraph')
    await page.getByRole('button', { name: 'Add block after this block' }).click()
    if (width < 768) {
      const sheet = page.getByRole('dialog', { name: 'Insert block' })
      await expect(sheet).toBeVisible()
      await sheet.getByRole('button', { name: 'Heading 1' }).click()
    } else {
      await expect(page.getByRole('dialog', { name: 'Insert block' })).toHaveCount(0)
      const menu = page.getByRole('listbox', { name: 'Insert block' })
      await expect(menu).toBeVisible()
      await menu.getByRole('option', { name: 'Insert Heading 1' }).click()
    }
    await expect(page.getByRole('textbox', { name: 'h1 block' })).toBeFocused()
    await expect(paragraph).toHaveValue('Original paragraph')
  })
}

for (const width of [375, 768]) {
  test(`insert choices dismiss on outside pointer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-dismiss-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/studio?new=article')
    const trigger = page.getByRole('button', { name: 'Add block after this block' })
    await trigger.click()
    if (width < 768) {
      const sheet = page.getByRole('dialog', { name: 'Insert block' })
      await expect(sheet).toBeVisible()
      await page.mouse.click(10, 10)
      await expect(sheet).toHaveCount(0)
      await expect(trigger).toBeFocused()
    } else {
      const menu = page.getByRole('listbox', { name: 'Insert block' })
      await expect(menu).toBeVisible()
      await page.getByRole('textbox', { name: 'Story title' }).click()
      await expect(menu).toHaveCount(0)
    }
  })
}

test.describe('phone touch dismissal', () => {
  test.use({ hasTouch: true, isMobile: true })

  for (const width of [375, 600]) test(`tapping outside the insert sheet closes it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-touch-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/studio?new=article')
    const trigger = page.getByRole('button', { name: 'Add block after this block' })
    await trigger.tap()
    const sheet = page.getByRole('dialog', { name: 'Insert block' })
    await expect(sheet).toBeVisible()
    const outsidePoint = { x: 10, y: width === 600 ? 500 : 10 }
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), outsidePoint)).toBe('Dismiss block options')
    await page.touchscreen.tap(outsidePoint.x, outsidePoint.y)
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

for (const width of [320, 1280]) {
  test(`editor insert menu stays visible near the bottom at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 420 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-overlay-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
      if (path.startsWith('/api/drafts')) return route.fulfill({ json: { data: { id: '507f1f77bcf86cd799439041', version: 1, title: '', blocks: [] } } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/studio?new=article')
    const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await paragraph.scrollIntoViewIfNeeded()
    await paragraph.press('/')
    const menu = page.getByRole('listbox', { name: 'Insert block' })
    await expect(menu).toBeVisible()
    expect(await menu.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const bar = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
      return element.parentElement === document.body && rect.top >= 56 && rect.bottom <= (bar?.height ? bar.top : window.innerHeight) && rect.left >= 0 && rect.right <= window.innerWidth
    })).toBe(true)
    await paragraph.press('ArrowDown')
    await expect(menu.getByRole('option', { name: 'Insert Heading 1' })).toHaveAttribute('aria-selected', 'true')
    await paragraph.press('Enter')
    await expect(menu).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'h1 block', exact: true })).toBeVisible()
  })
}

for (const width of [320, 1280]) {
  test(`slash arrows stay in the active block and scroll only the menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 520 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-keyboard-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path.startsWith('/api/drafts')) return route.fulfill({ json: { data: { id: 'keyboard-draft', version: 1 } } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
    })
    await page.goto('/studio?new=article')
    const paragraphs = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await paragraphs.first().fill('First paragraph')
    await paragraphs.first().press('Enter')
    await expect(paragraphs).toHaveCount(2)
    await paragraphs.nth(1).fill('Second paragraph')
    const anchor = paragraphs.first()
    await anchor.fill('/')
    const menu = page.getByRole('listbox', { name: 'Insert block' })
    await expect(menu).toBeVisible()
    const pageScroll = await page.locator('#main-content').evaluate(element => element.scrollTop)
    const labels = ['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Quote', 'Code', 'Image URL', 'Divider']
    for (const label of [...labels.slice(1), ...labels]) {
      await page.keyboard.press('ArrowDown')
      await expect(anchor).toBeFocused()
      const selected = menu.getByRole('option', { name: `Insert ${label}`, exact: true })
      await expect(selected).toHaveAttribute('aria-selected', 'true')
      expect(await selected.evaluate(element => {
        const item = element.getBoundingClientRect()
        const panel = element.closest('[role=listbox]').getBoundingClientRect()
        return item.top >= panel.top && item.bottom <= panel.bottom
      })).toBe(true)
      expect(await page.locator('#main-content').evaluate(element => element.scrollTop)).toBe(pageScroll)
    }
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('option', { name: 'Insert Text', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowUp')
    await expect(menu.getByRole('option', { name: 'Insert Divider', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(anchor).toHaveValue('/')
    await anchor.fill('/h')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'h2 block', exact: true })).toBeFocused()
    await expect(paragraphs).toHaveCount(1)
    await expect(paragraphs).toHaveValue('Second paragraph')
  })
}

test('slash selection survives autosave and empty filters recover safely', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-save-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path.startsWith('/api/drafts')) return route.fulfill({ json: { data: { id: 'keyboard-draft', version: 1 } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  const menu = page.getByRole('listbox', { name: 'Insert block' })
  await paragraph.fill('/')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('option', { name: 'Insert Heading 2' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('status').filter({ hasText: '✓ Saved' })).toBeVisible()
  await expect(menu.getByRole('option', { name: 'Insert Heading 2' })).toHaveAttribute('aria-selected', 'true')
  await paragraph.fill('/zzzz')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(paragraph).toHaveValue('/zzzz')
  await expect(paragraph).toHaveCount(1)
  await paragraph.fill('/quote')
  await expect(menu.getByRole('option', { name: 'Insert Quote' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'quote block', exact: true })).toHaveValue('')
  const quote = page.getByRole('textbox', { name: 'quote block', exact: true })
  await quote.fill('Before /cod')
  await expect(menu.getByRole('option', { name: 'Insert Code' })).toHaveAttribute('aria-selected', 'true')
  await quote.press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'code block', exact: true })).toHaveValue('Before ')
  await expect(page.getByRole('textbox', { name: 'code block', exact: true })).toBeFocused()
})

test('slash conversion removes only the command and code editing follows the theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-command-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path.startsWith('/api/drafts')) return route.fulfill({ json: { data: { id: 'command-draft', version: 1 } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await paragraph.fill('Before /qu after')
  await paragraph.evaluate(field => field.setSelectionRange(10, 10))
  await paragraph.press('o')
  await page.getByRole('option', { name: 'Insert Quote' }).click()
  const quote = page.getByRole('textbox', { name: 'quote block', exact: true })
  await expect(quote).toHaveValue('Before  after')
  await expect(quote).toHaveCSS('border-left-color', 'rgb(177, 170, 163)')
  await quote.fill('Code sample /cod')
  await page.getByRole('option', { name: 'Insert Code' }).click()
  const code = page.getByRole('textbox', { name: 'code block', exact: true })
  await expect(code).toHaveValue('Code sample ')
  await expect(code).toHaveCSS('background-color', 'rgb(35, 35, 36)')
  await expect(code).toHaveCSS('color', 'rgb(238, 236, 232)')
})

test('editing a short restores autosaved changes and updates only on command', async ({ page }) => {
  const postId = '507f1f77bcf86cd799439041'
  const draftRequests = []
  const updates = []
  let publishedPost = {
    _id: postId, title: 'Original short', format: 'short', currentRevision: 2,
    body: JSON.stringify([{ id: 'story', type: 'text', content: 'Original story' }]), tags: [],
  }
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const { pathname } = new URL(route.request().url())
    const request = route.request()
    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'editor-update-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (pathname === `/api/post/${postId}` && request.method() === 'GET') return route.fulfill({ json: { postData: publishedPost } })
    if (pathname === `/api/post/${postId}` && request.method() === 'PUT') {
      updates.push(request.postDataJSON())
      publishedPost = { ...publishedPost, ...request.postDataJSON(), currentRevision: 3 }
      return route.fulfill({ json: { data: { _id: postId, currentRevision: 3 } } })
    }
    if (pathname.startsWith('/api/drafts')) draftRequests.push(request.method())
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto(`/studio?edit=${postId}&draft=stale-draft`)
  await expect(page.getByRole('heading', { name: 'Edit Short' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Short title' }).fill('Updated short')
  await page.getByRole('textbox', { name: 'Paragraph block' }).fill('Updated story')
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find(value => value.startsWith('ink-rider:post-edit:'))
    const saved = key && JSON.parse(localStorage.getItem(key))
    return saved?.title === 'Updated short' && saved.blocks[0]?.content === 'Updated story'
  })).toBe(true)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Short title' })).toHaveValue('Updated short')
  await expect(page.getByRole('textbox', { name: 'Paragraph block' })).toHaveValue('Updated story')
  expect(updates).toEqual([])
  await page.getByRole('button', { name: 'Update', exact: true }).first().click()
  await page.getByRole('button', { name: 'Update', exact: true }).last().click()
  await expect.poll(() => updates.length).toBe(1)
  expect(updates[0]).toMatchObject({ expectedRevision: 2, title: 'Updated short' })
  expect(draftRequests).toEqual([])
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('ink-rider:post-edit:')))).toBe(false)
  await page.evaluate(({ id, body }) => localStorage.setItem(`ink-rider:post-edit:Writer:${id}`, JSON.stringify({
    title: 'Updated short', blocks: JSON.parse(body), tags: [], publicAt: '', expectedRevision: 2,
  })), { id: postId, body: publishedPost.body })
  await page.goto(`/studio?edit=${postId}`)
  await expect(page.getByRole('textbox', { name: 'Short title' })).toHaveValue('Updated short')
  await expect(page.getByRole('alert').filter({ hasText: 'This post changed since your saved edit' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('ink-rider:post-edit:')))).toBe(false)
})
