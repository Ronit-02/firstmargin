import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from '@playwright/test'

const id = '507f1f77bcf86cd799439021'
const title = 'Modal audit story'
const story = { id, _id: id, title, excerpt: 'A focused idea.', abstract: 'A focused idea.', author: { username: 'Audit Writer', handle: 'audit-writer' }, createdAt: '2026-09-08', tags: ['science'], readTime: '1 min read', likesCount: 1, commentsCount: 20, body: JSON.stringify([{ id: 'text', type: 'text', content: 'Long reading content for scrolling. '.repeat(100) }]) }
const collection = { id, title: 'Audit collection', description: 'A reading path.', postsCount: 3, isOwner: true, visibility: 'public', author: { username: 'Audit Writer' } }

async function mockApi(page, { guest = false, eligibleError = false, mutationError = false, readError = false, longNames = false } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(guest ? { status: 401, json: { message: 'Signed out' } } : { json: { accessToken: 'modal-audit-token', user: 'Audit Reader', email: 'reader@example.test', role: 'regular' } })
    if (mutationError && ['POST', 'DELETE'].includes(route.request().method())) return route.fulfill({ status: 500, json: { message: 'Audit mutation failed' } })
    if (readError && (path === `/api/post/${id}` || path.endsWith('/comments'))) return route.fulfill({ status: 500, json: { message: 'Audit read failed' } })
    if (/eligible-(posts|shorts)$/.test(path)) return route.fulfill(eligibleError ? { status: 500, json: { message: 'Eligible writing unavailable' } } : { json: { data: [story, { ...story, id: '507f1f77bcf86cd799439022', title: 'Second audit story' }] } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: [story], writers: [], shorts: [story] } } })
    if (path === '/api/post/shorts' || path === '/api/post/feed') return route.fulfill({ json: { data: [story], meta: { nextCursor: null } } })
    if (path === `/api/post/${id}`) return route.fulfill({ json: { postData: story } })
    if (path.endsWith('/comments')) return route.fulfill({ json: { data: Array.from({ length: 20 }, (_, index) => ({ id: `comment-${index}`, content: 'A long audit comment. '.repeat(10), createdAt: '2026-09-08', author: { name: longNames ? 'W'.repeat(30) : 'Audit commenter' } })), meta: { nextCursor: null } } })
    if (path === '/api/collection') return route.fulfill({ json: { data: [collection], meta: { nextCursor: null } } })
    if (path === `/api/competition/${id}`) return route.fulfill({ json: { data: { id, title: 'Audit competition', description: 'Write a thoughtful article.', status: 'open', deadline: '2027-01-01', canEnter: true, judgingMode: 'community', entries: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
}

const surfaces = [
  { key: 'account', path: '/shorts', trigger: 'Account', name: 'Account', close: 'Close account menu', mobile: true },
  { key: 'search', path: '/shorts', name: 'Search firstmargin', close: 'Close search', mobile: true },
  { key: 'comments', path: '/shorts', trigger: `Comments on ${title}`, name: 'Comments', close: 'Close comments', dirty: 'Add a comment' },
  { key: 'short', path: '/shorts', trigger: title, name: title, close: 'Close short', dirty: 'Add a comment' },
  { key: 'question', path: '/explore/questions', trigger: 'Ask a question', name: 'Ask the community', close: 'Close', dirty: 'Question' },
  { key: 'collection', path: '/collections', trigger: 'Create collection', name: 'Create a collection', close: 'Close', dirty: 'Title' },
  { key: 'series', path: '/series?type=short', trigger: 'Create a series', name: 'Create a short series', close: 'Close', dirty: 'Title' },
  { key: 'entry', path: `/explore/competitions/${id}`, trigger: 'Add your entry', name: 'Submit an article', close: 'Close', dirty: /Author note/ },
  { key: 'delete', path: '/collections', trigger: 'More options for Audit collection', name: 'Delete collection?', close: 'Cancel delete' },
]

async function open(page, surface) {
  const trigger = surface.key === 'search' ? page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox', { name: 'Search stories and writers' }) : surface.key === 'short' ? page.getByRole('link', { name: title, exact: true }) : page.getByRole('button', { name: surface.trigger, exact: true }).first()
  await trigger.click()
  if (surface.key === 'delete') await page.getByRole('menuitem', { name: 'Delete collection', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: surface.name, exact: true })
  await expect(dialog).toBeVisible()
  await expectModalHeader(dialog)
  return { trigger, dialog }
}

// Record visual/accessibility defects as audit evidence without asserting that
// the current application meets requirements it has not yet implemented.
async function inspect(dialog) {
  return dialog.evaluate(element => {
    const panel = element.querySelector(':scope > section') || element
    const bounds = panel.getBoundingClientRect()
    const color = getComputedStyle(panel)
    const smallTargets = [...element.querySelectorAll('button, a[href]')].filter(node => node.getClientRects().length && !node.disabled).map(node => {
      const rect = node.getBoundingClientRect()
      return { label: node.getAttribute('aria-label') || node.textContent.trim(), width: rect.width, height: rect.height }
    }).filter(rect => rect.width < 40 || rect.height < 40)
    const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
    const luminance = value => rgb(value).map(channel => { const s = channel / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const lowContrast = [...element.querySelectorAll('p, label, time, span, h2, button, a')].filter(node => node.getClientRects().length && node.textContent.trim() && !node.classList.contains('sr-only') && !node.disabled && !node.children.length).flatMap(node => {
      const style = getComputedStyle(node)
      let parent = node
      let background = 'rgba(0, 0, 0, 0)'
      while (parent && background === 'rgba(0, 0, 0, 0)') { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement }
      if (background === 'rgba(0, 0, 0, 0)' || style.opacity !== '1') return []
      const values = [luminance(style.color), luminance(background)].sort((a, b) => a - b)
      const ratio = (values[1] + 0.05) / (values[0] + 0.05)
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
      return ratio + 0.01 < (large ? 3 : 4.5) ? [{ text: node.textContent.trim().slice(0, 70), ratio: Number(ratio.toFixed(2)), foreground: style.color, background }] : []
    })
    return { modal: element.matches(':modal'), bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, surface: color.backgroundColor, text: color.color, smallTargets, lowContrast, horizontalOverflow: element.scrollWidth > element.clientWidth, scrollContainers: [...element.querySelectorAll('*'), element].filter(node => node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY === 'auto').length }
  })
}

for (const theme of ['light', 'dark']) {
  for (const viewport of [{ width: 320, height: 360 }, { width: 1280, height: 720 }]) {
    for (const surface of surfaces.filter(surface => !surface.mobile || viewport.width < 768)) {
      test(`${surface.key}: ${theme}, ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport)
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
        await mockApi(page)
        await page.goto(surface.path)
        let { dialog, trigger } = await open(page, surface)
        if (surface.key === 'short') await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible()
        if (surface.key === 'account') await dialog.getByRole('button', { name: 'Help', exact: true }).click()
        const result = await inspect(dialog)
        await page.screenshot({ path: testInfo.outputPath('initial-modal.png') })
        expect(result.modal).toBe(true)
        expect(result.horizontalOverflow).toBe(false)
        expect(result.bounds.x).toBeGreaterThanOrEqual(-1)
        expect(result.bounds.y).toBeGreaterThanOrEqual(-1)
        expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(viewport.width + 1)
        expect(result.bounds.y + result.bounds.height).toBeLessThanOrEqual(viewport.height + 1)
        expect(result.surface).toBe(surface.key === 'search' ? (theme === 'dark' ? 'rgb(26, 26, 27)' : 'rgb(255, 255, 255)') : (theme === 'dark' ? 'rgb(31, 31, 32)' : 'rgb(255, 255, 255)'))
        for (let index = 0; index < 18; index++) {
          await page.keyboard.press(index < 9 ? 'Tab' : 'Shift+Tab')
          expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
        }
        // Programmatic focus on background must be blocked by the native dialog.
        await trigger.evaluate(element => element.focus())
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
        const close = dialog.getByRole('button', { name: surface.close, exact: true })
        await close.scrollIntoViewIfNeeded()
        await expect(close).toBeInViewport()
        await page.screenshot({ path: testInfo.outputPath('modal.png') })
        await close.click()
        await expect(dialog).toHaveCount(0)
        await expect(trigger).toBeFocused()
        ;({ dialog } = await open(page, surface))
        if (surface.dirty) {
          const field = dialog.getByLabel(surface.dirty, { exact: surface.dirty === 'Question' || surface.dirty === 'Add a comment' })
          await field.fill('An unsaved audit draft')
        }
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(trigger).toBeFocused()
        ;({ dialog } = await open(page, surface))
        if (surface.dirty) result.draftLostOnEscape = await dialog.getByLabel(surface.dirty, { exact: surface.dirty === 'Question' || surface.dirty === 'Add a comment' }).inputValue() === ''
        if (surface.key !== 'search') {
          await dialog.click({ position: { x: 2, y: 2 } })
          await expect(dialog).toHaveCount(0)
          await expect(trigger).toBeFocused()
        } else await page.keyboard.press('Escape')
        if (result.smallTargets.length) testInfo.annotations.push({ type: 'audit finding', description: 'Control targets below 40px; see observations.' })
        if (result.lowContrast.length) testInfo.annotations.push({ type: 'audit finding', description: 'Text contrast below its target; see observations.' })
        if (result.draftLostOnEscape) testInfo.annotations.push({ type: 'audit finding', description: 'Unsaved text disappears after Escape and reopening.' })
        await testInfo.attach('audit-observations', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
      })
    }
  }
}

for (const surface of surfaces.filter(surface => ['collection', 'series', 'entry'].includes(surface.key))) {
  test(`${surface.key}: eligible-list failure observations`, async ({ page }, testInfo) => {
    await mockApi(page, { eligibleError: true })
    await page.goto(surface.path)
    const settled = page.waitForResponse(response => /eligible-(posts|shorts)$/.test(new URL(response.url()).pathname) && response.status() === 500)
    const { dialog } = await open(page, surface)
    await settled
    // The default query policy attempts the original read plus three retries.
    await page.waitForResponse(response => /eligible-(posts|shorts)$/.test(new URL(response.url()).pathname) && response.status() === 500)
    await page.waitForResponse(response => /eligible-(posts|shorts)$/.test(new URL(response.url()).pathname) && response.status() === 500)
    await page.waitForResponse(response => /eligible-(posts|shorts)$/.test(new URL(response.url()).pathname) && response.status() === 500)
    await testInfo.attach('eligible-failure', { body: JSON.stringify({ alertCount: await dialog.getByRole('alert').count(), retryCount: await dialog.getByRole('button', { name: /try again|retry/i }).count() }), contentType: 'application/json' })
  })
}

for (const surface of surfaces) {
  test(`${surface.key}: live system theme and internal scrolling`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 360 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await mockApi(page)
    await page.goto(surface.path)
    const { dialog } = await open(page, surface)
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect.poll(async () => (await inspect(dialog)).surface).toBe(surface.key === 'search' ? 'rgb(26, 26, 27)' : 'rgb(31, 31, 32)')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const scrolling = await dialog.evaluate(async element => {
      const containers = [...element.querySelectorAll('*'), element].filter(node => node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY === 'auto')
      const root = document.querySelector('[data-app-scroll]')
      const before = root.scrollTop
      const distances = containers.map(node => { node.scrollTop = node.scrollHeight; return node.scrollTop })
      await new Promise(resolve => requestAnimationFrame(resolve))
      return { distances, backgroundMoved: root.scrollTop !== before }
    })
    expect(scrolling.backgroundMoved).toBe(false)
    if (surface.key !== 'delete') expect(scrolling.distances.some(distance => distance > 0)).toBe(true)
    await testInfo.attach('scroll-observations', { body: JSON.stringify(scrolling), contentType: 'application/json' })
    await page.keyboard.press('Escape')
  })
}

for (const key of ['account', 'search', 'comments', 'short']) {
  test(`${key}: guest access`, async ({ page }) => {
    const surface = surfaces.find(surface => surface.key === key)
    await page.setViewportSize({ width: 390, height: 600 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApi(page, { guest: true })
    await page.goto(surface.path)
    const { dialog } = await open(page, surface)
    if (key === 'account') await expect(dialog.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
    if (key === 'comments' || key === 'short') await expect(dialog.getByText('Sign in to join the conversation.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
}

for (const key of ['question', 'collection', 'series', 'entry', 'comments', 'short', 'delete']) {
  test(`${key}: mutation failure retains dialog`, async ({ page }) => {
    const surface = surfaces.find(surface => surface.key === key)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApi(page, { mutationError: true })
    await page.goto(surface.path)
    const { dialog } = await open(page, surface)
    if (surface.dirty) await dialog.getByLabel(surface.dirty, { exact: surface.dirty === 'Question' || surface.dirty === 'Add a comment' }).fill('An unsaved audit draft')
    if (key === 'series') await dialog.getByRole('checkbox').evaluateAll(elements => elements.forEach(element => element.click()))
    if (key === 'entry') {
      await dialog.getByRole('combobox').click()
      await dialog.getByRole('option', { name: title, exact: true }).click()
    }
    const submitName = { question: 'Post question', collection: 'Create collection', series: 'Create series', entry: 'Submit entry', comments: 'Comment', short: 'Comment', delete: 'Delete collection' }[key]
    await dialog.getByRole('button', { name: submitName, exact: true }).click()
    await expect(key === 'delete' ? page.getByText('The collection could not be deleted.') : dialog.getByRole('alert')).toBeVisible()
    await expect(dialog).toBeVisible()
    await expectModalHeader(dialog)
    if (surface.dirty) await expect(dialog.getByLabel(surface.dirty, { exact: surface.dirty === 'Question' || surface.dirty === 'Add a comment' })).toHaveValue('An unsaved audit draft')
  })
}

for (const key of ['comments', 'short']) {
  test(`${key}: read failure has retry`, async ({ page }) => {
    const surface = surfaces.find(surface => surface.key === key)
    await mockApi(page, { readError: true })
    await page.goto(surface.path)
    // A short's accessible name uses the fallback label until it loads.
    const { dialog } = await open(page, key === 'short' ? { ...surface, name: 'Short' } : surface)
    await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  })
}

test('comments: long writer names', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 600 })
  await mockApi(page, { longNames: true })
  await page.goto('/shorts')
  const { dialog } = await open(page, surfaces.find(surface => surface.key === 'comments'))
  await expect(dialog.getByText('W'.repeat(30)).first()).toBeVisible()
  await testInfo.attach('long-name-observations', { body: JSON.stringify(await dialog.evaluate(element => ({ overflowingCommentRows: [...element.querySelectorAll('article')].filter(node => node.scrollWidth > node.clientWidth).length }))), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath('long-comment-name.png') })
})
