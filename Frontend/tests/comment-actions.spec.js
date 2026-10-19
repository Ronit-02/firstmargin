import { test, expect } from '@playwright/test'

const postId = '507f1f77bcf86cd799439012'
const parentId = '507f1f77bcf86cd799439013'
const date = '2026-10-10T00:00:00Z'

test('article composer opens with the discussion and reveals the confirmed comment', async ({ page }) => {
  const state = await fixture(page, { noReplies: true })
  await page.goto(`/post/${postId}`)
  const section = page.getByRole('region', { name: /^Comments \(/ })
  const toggle = section.getByRole('button', { name: /^Comments \(/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(section.getByLabel('Add a comment')).toBeHidden()
  expect(state.reads).toEqual([])
  await toggle.click()
  await section.getByLabel('Add a comment').fill('Posted after expanding')
  await section.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(section.getByText('Posted after expanding', { exact: true })).toBeVisible()
  await expect(section.getByLabel('Add a comment')).toHaveValue('')
})

for (const width of [320, 1280]) {
  test(`comment disclosure, modal dismissal and leaf deletion at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 640 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const state = await fixture(page, { noReplies: true })
    await page.goto(`/post/${postId}`)
    const section = page.getByRole('region', { name: /^Comments \(/ })
    const toggle = section.getByRole('button', { name: /^Comments \(/  })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveCSS('border-radius', '0px')
    await expect(toggle).toHaveCSS('border-top-width', '0px')
    await expect(toggle).toHaveCSS('border-bottom-width', '0px')
    const toggleBounds = await toggle.boundingBox()
    const sectionBounds = await section.boundingBox()
    expect(toggleBounds.width).toBeCloseTo(sectionBounds.width, 0)
    expect(toggleBounds.height).toBeGreaterThanOrEqual(44)
    const chevron = toggle.locator('[data-disclosure-chevron]')
    await expect(chevron).toBeVisible()
    await expect(section.getByLabel('Add a comment')).toBeHidden()
    expect(state.reads).toEqual([])
    await toggle.press('Enter')
    await expect(section.getByLabel('Add a comment')).toBeVisible()
    const hideToggle = section.getByRole('button', { name: /^Comments \(/  })
    await expect(hideToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(hideToggle.locator('[data-disclosure-chevron]')).toHaveCSS('rotate', '180deg')
    await section.screenshot({ path: testInfo.outputPath('comments-disclosure-expanded.png') })
    const input = section.getByLabel('Add a comment')
    await input.fill('Keep this draft')
    await section.getByRole('button', { name: /^Comments \(/  }).click()
    await expect(input).toBeHidden()
    await expect(section.locator('article').first()).toBeHidden()
    await toggle.click()
    await expect(input).toHaveValue('Keep this draft')
    await hideToggle.press('Space')
    await expect(input).toBeHidden()
    await expect(section.locator('article').first()).toBeHidden()
    await toggle.press('Space')
    await expect(input).toHaveValue('Keep this draft')
    const row = section.locator('article').first()
    const edit = row.getByRole('button', { name: 'Edit', exact: true })
    await edit.click()
    const editor = page.getByRole('dialog', { name: 'Edit comment', exact: true })
    await expect(editor.getByLabel('Edit comment')).toBeFocused()
    await expect(editor).toHaveJSProperty('open', true)
    await editor.getByLabel('Edit comment').fill('Unsubmitted edit')
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
    await expect(edit).toBeFocused()
    await expect(row.getByText('An original comment', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Reply', exact: true }).click()
    expect(await row.locator('[data-comment-reply-form]').evaluate(node => parseFloat(getComputedStyle(node).marginBottom))).toBe(16)
    await row.getByRole('button', { name: 'Cancel', exact: true }).click()
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('dialog', { name: 'Delete comment?', exact: true }).getByRole('button', { name: 'Delete comment', exact: true }).click()
    await expect(section.locator('article')).toHaveCount(0)
    await expect(section.getByText('Deleted comment', { exact: true })).toHaveCount(0)
    await expect(section.getByRole('heading', { name: 'Comments (0)' })).toBeVisible()
    await expect(section.getByRole('button', { name: /^Comments \(/  })).toBeFocused()
  })
}

test('replies start hidden and expand with their count', async ({ page }) => {
  const state = await fixture(page)
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: /^Comments \(/  }).click()
  const row = page.getByRole('region', { name: /^Comments \(/ }).locator('article').first()
  const replies = row.getByRole('button', { name: 'View replies (2)' })
  await expect(replies).toHaveAttribute('aria-expanded', 'false')
  expect(state.reads).toEqual([null])
  await replies.click()
  await expect(row.getByText('Someone else replied')).toBeVisible()
  await row.getByRole('button', { name: 'Hide replies' }).click()
  await expect(row.getByText('Someone else replied')).toBeHidden()
  await expect(replies).toHaveAttribute('aria-expanded', 'false')
})

test('edit modal protects pending writes and retains failed text on a short phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 360 })
  await page.addInitScript(() => localStorage.setItem('ink-theme', 'dark'))
  const state = await fixture(page)
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: /^Comments \(/  }).click()
  const edit = page.getByRole('region', { name: /^Comments \(/ }).getByRole('button', { name: 'Edit', exact: true })
  await edit.click()
  const dialog = page.getByRole('dialog', { name: 'Edit comment', exact: true })
  const input = dialog.getByLabel('Edit comment')
  await input.fill('Retain this failed edit')
  let release
  state.hold = new Promise(resolve => { release = resolve })
  state.fail = 'PATCH'
  const save = dialog.getByRole('button', { name: 'Save comment' })
  await save.click()
  await expect(save).toBeDisabled()
  await expect(save).toHaveAttribute('aria-busy', 'true')
  await dialog.getByRole('button', { name: 'Close comment action' }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.requests.filter(request => request.method === 'PATCH')).toHaveLength(1)
  release(); state.hold = null
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(input).toHaveValue('Retain this failed edit')
  expect(await dialog.locator('section').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await dialog.screenshot({ path: testInfo.outputPath('edit-comment-modal.png') })
  await save.click()
  await expect(dialog).toBeHidden()
  await expect(edit).toBeFocused()
  await expect(page.getByText('Retain this failed edit', { exact: true })).toBeVisible()
})

async function fixture(page, { guest = false, longName = false, noReplies = false, commentText = 'An original comment', replyText = 'Someone else replied' } = {}) {
  const records = [
    { id: parentId, content: commentText, createdAt: date, author: { name: 'Reader' }, canEdit: true, canDelete: true, likesCount: 0, isLiked: false, parentCommentId: null },
    { id: 'reply-1', content: replyText, createdAt: date, author: { name: 'Other reader' }, canEdit: false, canDelete: false, parentCommentId: parentId },
    { id: 'reply-2', content: 'A second reply', createdAt: date, author: { name: 'Other reader' }, parentCommentId: parentId },
  ]
  if (noReplies) records.splice(1)
  if (longName) records[0].author.name = 'abcdefghijklmnopqrstuvwxyz1234'
  const state = { requests: [], reads: [], fail: null, hold: null }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: guest ? 401 : 200, json: guest ? { message: 'Signed out' } : { accessToken: 'test-token', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (url.pathname === '/api/writer/writer') return route.fulfill({ json: { data: { id: 'writer-id', handle: 'writer', displayName: 'Writer', joinedAt: date, followersCount: 0, posts: [{ id: postId, title: 'Comment action testing', tags: [], createdAt: date, commentsCount: 3 }] } } })
    if (url.pathname === `/api/post/${postId}`) return route.fulfill({ json: { postData: { _id: postId, title: 'Comment action testing', body: JSON.stringify([{ id: 'text', type: 'text', content: 'Read and discuss.' }]), tags: [], createdAt: date, commentsCount: records.filter(c => !c.isDeleted).length, author: { username: 'Writer', handle: 'writer' } } } })
    if (url.pathname.includes('/comments')) {
      if (method !== 'GET') {
        state.requests.push({ method, path: url.pathname, body: req.postData() ? req.postDataJSON() : null })
        if (state.hold) await state.hold
        if (state.fail === method) { state.fail = null; return route.fulfill({ status: 500, json: { message: 'Try again' } }) }
      }
      if (method === 'GET') {
        state.reads.push(url.searchParams.get('parentCommentId'))
        const parent = url.searchParams.get('parentCommentId')
        const visible = row => !row.isDeleted || records.some(child => child.parentCommentId === row.id && visible(child))
        const list = records.filter(row => (row.parentCommentId || null) === parent && visible(row))
        const page = parent ? list.slice(url.searchParams.get('cursor') ? 1 : 0, url.searchParams.get('cursor') ? list.length : 1) : list
        return route.fulfill({ json: { data: page.map(row => ({ ...row, canEdit: !guest && !row.isDeleted && Boolean(row.canEdit), canDelete: !guest && !row.isDeleted && Boolean(row.canDelete), repliesCount: records.filter(c => c.parentCommentId === row.id && visible(c)).length })), meta: { nextCursor: parent && list.length > 1 && !url.searchParams.get('cursor') ? 'next' : null, totalCount: records.filter(c => !c.isDeleted).length } } })
      }
      const id = url.pathname.split('/comments/')[1]?.split('/')[0]
      const row = records.find(c => c.id === id)
      if (url.pathname.endsWith('/like')) {
        row.isLiked = method === 'PUT'; row.likesCount = row.isLiked ? 1 : 0
        return route.fulfill({ json: { data: row } })
      }
      if (method === 'PATCH') row.content = req.postDataJSON().text
      if (method === 'DELETE') { row.isDeleted = true; row.content = ''; row.author = null; row.canEdit = false; row.canDelete = false }
      if (method === 'POST') {
        const body = req.postDataJSON()
        const reply = { id: `new-${records.length}`, content: body.text, parentCommentId: body.parentCommentId || null, author: { name: 'Reader' }, createdAt: date, canEdit: true, canDelete: true }
        records.unshift(reply)
        return route.fulfill({ json: { data: reply } })
      }
      return route.fulfill({ json: { data: method === 'DELETE' ? { id, deleted: true, isDeleted: true } : row } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  return state
}

for (const width of [320, 1280]) {
  for (const compact of [false, true]) {
    test(`comments expand only beyond four lines at ${width}px ${compact ? 'dialog' : 'article'}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(value => localStorage.setItem('ink-theme', value), compact ? 'dark' : 'light')
      const fourLines = 'First line\nSecond line\nThird line\nFourth line'
      const fiveLines = `${fourLines}\nFifth line`
      const state = await fixture(page, { commentText: fourLines, replyText: fiveLines })
      await page.goto(compact ? '/author/writer' : `/post/${postId}`)
      if (compact) await page.getByRole('button', { name: 'Comments on Comment action testing' }).click()
      else await page.getByRole('button', { name: /^Comments \(/  }).click()
      const section = page.getByRole('region', { name: /^Comments \(/ })
      const comment = section.locator('article').first()
      const content = comment.locator('[data-comment-content]').first()
      await expect(content).toHaveText(fourLines)
      await expect(comment.getByRole('button', { name: 'Read more', exact: true })).toHaveCount(0)
      await comment.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByLabel('Edit comment', { exact: true }).fill(fiveLines)
      await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByRole('button', { name: 'Save comment' }).click()
      const more = comment.getByRole('button', { name: 'Read more', exact: true })
      await expect(more).toBeVisible()
      await expect(more).toHaveAttribute('aria-expanded', 'false')
      await expect(more).toHaveAttribute('aria-controls', await content.getAttribute('id'))
      const height = await content.evaluate(node => ({ height: node.getBoundingClientRect().height, line: parseFloat(getComputedStyle(node).lineHeight) }))
      expect(Math.abs(height.height - height.line * 4)).toBeLessThan(1)
      await more.focus()
      await page.keyboard.press('Enter')
      const less = comment.getByRole('button', { name: 'Show less', exact: true })
      await expect(less).toHaveAttribute('aria-expanded', 'true')
      await expect(less).toBeFocused()
      expect((await content.boundingBox()).height).toBeGreaterThan(height.height)
      await less.click()
      await expect(more).toHaveAttribute('aria-expanded', 'false')
      expect((await content.boundingBox()).height).toBeCloseTo(height.height, 0)
      expect(state.requests.filter(request => request.method !== 'PATCH')).toHaveLength(0)
      await comment.getByRole('button', { name: 'View replies (2)' }).click()
      const reply = comment.locator('article').first()
      await expect(reply.getByRole('button', { name: 'Read more', exact: true })).toBeVisible()
      await reply.getByRole('button', { name: 'Read more', exact: true }).click()
      await expect(reply.getByRole('button', { name: 'Show less', exact: true })).toBeVisible()
      await section.screenshot({ path: testInfo.outputPath('read-more.png') })
    })
  }
}

test('wrapped guest comments remeasure the four-line threshold on resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const state = await fixture(page, { guest: true, commentText: 'Writing slowly helps us notice what we would otherwise miss. '.repeat(5) })
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: /^Comments \(/  }).click()
  const comment = page.getByRole('region', { name: /^Comments \(/ }).locator('article').first()
  await expect(comment.locator('[data-comment-content]')).toBeVisible()
  await expect(comment.getByRole('button', { name: 'Read more', exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 900 })
  const more = comment.getByRole('button', { name: 'Read more', exact: true })
  await expect(more).toBeVisible()
  await more.click()
  await expect(comment.getByRole('button', { name: 'Show less', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await comment.getByRole('button', { name: 'Show less', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(more).toHaveCount(0)
  expect(state.requests).toEqual([])
})

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {
    for (const compact of [false, true]) {
      test(`comment layout ${width}px ${theme} ${compact ? 'dialog' : 'article'}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 })
        await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
        const state = await fixture(page, { longName: true })
        await page.goto(compact ? '/author/writer' : `/post/${postId}`)
        if (compact) await page.getByRole('button', { name: 'Comments on Comment action testing' }).click()
      else await page.getByRole('button', { name: /^Comments \(/  }).click()
        const section = page.getByRole('region', { name: /^Comments \(/ })
        const composer = section.locator('[data-comment-composer]')
        const input = composer.getByLabel('Add a comment', { exact: true })
        const submit = composer.getByRole('button', { name: 'Comment', exact: true })
        await expect(submit).toBeDisabled()
        await input.fill('A new comment')
        await expect(submit).toBeEnabled()
        await expect(composer.getByText('13/1000', { exact: true })).toBeVisible()
        await composer.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(input).toHaveValue('')
        await input.fill('Posted from the updated composer')
        await submit.click()
        await expect(section.getByText('Posted from the updated composer', { exact: true })).toBeVisible()
        await expect(input).toHaveValue('')
        expect(state.requests.filter(request => request.method === 'POST')).toHaveLength(1)
        const layout = await section.evaluate(element => {
          const box = element.getBoundingClientRect()
          const overflows = [...element.querySelectorAll('article, textarea, time')].some(child => {
            const rect = child.getBoundingClientRect()
            return rect.left < box.left - 1 || rect.right > box.right + 1 || child.scrollWidth > child.clientWidth + 1
          })
          return { overflows, target: element.querySelector('[data-comment-composer] button[type="submit"]').getBoundingClientRect().height }
        })
        expect(layout.overflows).toBe(false)
        expect(layout.target).toBeGreaterThanOrEqual(44)
        await section.screenshot({ path: testInfo.outputPath('layout.png') })
      })
    }
  }
}

for (const width of [320, 1280]) {
  test(`edit, like, reply and delete preserve a thread at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const state = await fixture(page)
    await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: /^Comments \(/  }).click()
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Comments \(/ }) })
    const comment = section.locator('article').first()
    await comment.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByLabel('Edit comment', { exact: true }).fill('Edited comment')
    state.fail = 'PATCH'
    await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByRole('button', { name: 'Save comment' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByRole('alert')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByLabel('Edit comment')).toHaveValue('Edited comment')
    await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByRole('button', { name: 'Save comment' }).click()
    await expect(comment.getByText('Edited comment', { exact: true })).toBeVisible()
    let release
    state.hold = new Promise(resolve => { release = resolve })
    const like = comment.getByRole('button', { name: 'Appreciate (0)', exact: true })
    const likeBox = await like.evaluate(button => {
      const box = button.getBoundingClientRect()
      const threadBox = button.closest('article').getBoundingClientRect()
      return { x: box.x - threadBox.x, y: box.y - threadBox.y, width: box.width, height: box.height }
    })
    await expect(comment.getByRole('button', { name: 'Appreciate (0)', exact: true })).toHaveText('0')
    await expect(comment.getByRole('button', { name: 'Appreciate (0)', exact: true }).locator('svg')).toHaveAttribute('fill', 'none')
    await comment.getByRole('button', { name: 'Appreciate (0)', exact: true }).click()
    await expect(comment.getByRole('button', { name: 'Appreciate (0)' })).toHaveAttribute('aria-busy', 'true')
    await expect(like).toBeDisabled()
    await section.screenshot({ path: testInfo.outputPath('like-pending.png') })
    expect(await like.evaluate(button => getComputedStyle(button).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    expect(await like.evaluate(button => {
      const box = button.getBoundingClientRect()
      const threadBox = button.closest('article').getBoundingClientRect()
      return { x: box.x - threadBox.x, y: box.y - threadBox.y, width: box.width, height: box.height }
    })).toEqual(likeBox)
    expect(state.requests.filter(r => r.method === 'PUT')).toHaveLength(1)
    release(); state.hold = null
    await expect(comment.getByRole('button', { name: 'Remove appreciation (1)' })).toHaveAttribute('aria-pressed', 'true')
    await expect(comment.getByRole('button', { name: 'Remove appreciation (1)' })).toHaveText('1')
    await expect(comment.getByRole('button', { name: 'Remove appreciation (1)' }).locator('svg')).toHaveAttribute('fill', 'currentColor')
    await comment.getByRole('button', { name: 'Remove appreciation (1)' }).click()
    await expect(comment.getByRole('button', { name: 'Appreciate (0)' })).toHaveAttribute('aria-pressed', 'false')
    await comment.getByRole('button', { name: 'View replies (2)' }).click()
    await expect(comment.getByText('Someone else replied')).toBeVisible()
    await expect(comment.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1)
    await expect(comment.getByText('A second reply')).toBeVisible()
    await comment.getByRole('button', { name: 'Reply', exact: true }).first().click()
    await comment.getByLabel('Reply to Reader', { exact: true }).fill('My reply')
    await comment.getByRole('button', { name: 'Post reply' }).click()
    await expect(comment.getByText('My reply', { exact: true })).toBeVisible()
    expect(state.requests.find(r => r.method === 'POST').body.parentCommentId).toBe(parentId)
    // The original comment stays first; newly created replies have their own owner controls.
    await comment.getByRole('button', { name: 'Delete', exact: true }).first().click()
    await page.getByRole('dialog', { name: 'Delete comment?', exact: true }).getByRole('button', { name: 'Close comment action' }).click()
    expect(state.requests.filter(r => r.method === 'DELETE' && !r.path.endsWith('/like'))).toHaveLength(0)
    await comment.getByRole('button', { name: 'Delete', exact: true }).first().click()
    state.fail = 'DELETE'
    await page.getByRole('dialog', { name: 'Delete comment?', exact: true }).getByRole('button', { name: 'Delete comment', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Delete comment?', exact: true }).getByRole('alert')).toBeVisible()
    await expect(comment.getByText('Edited comment', { exact: true })).toBeVisible()
    await page.getByRole('dialog', { name: 'Delete comment?', exact: true }).getByRole('button', { name: 'Delete comment', exact: true }).click()
    await expect(comment.getByText('Comment deleted.', { exact: true })).toBeVisible()
    await expect(comment.getByText('Someone else replied')).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Comments (3)' })).toBeVisible()
    await expect(comment.getByRole('button', { name: 'Appreciate (0)', exact: true })).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    while (await page.getByRole('button', { name: 'Dismiss notification' }).count()) await page.getByRole('button', { name: 'Dismiss notification' }).first().click()
    await section.screenshot({ path: testInfo.outputPath(`comments-${width}.png`) })
  })
}

for (const [width, theme] of [[320, 'dark'], [1280, 'light']]) {
  test(`compact comment likes keep stable pending targets and retry at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    const state = await fixture(page)
    await page.goto('/author/writer')
    await page.getByRole('button', { name: 'Comments on Comment action testing' }).click()
    const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
    const comment = dialog.locator('article').first()
    const like = comment.locator('[data-comment-like]')
    await like.scrollIntoViewIfNeeded()
    const before = await like.boundingBox()
    let release
    state.hold = new Promise(resolve => { release = resolve })
    await like.click()
    await expect(like).toHaveAttribute('aria-busy', 'true')
    await expect(like).toBeDisabled()
    expect(await like.evaluate(button => getComputedStyle(button).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    expect(await like.boundingBox()).toEqual(before)
    await dialog.screenshot({ path: testInfo.outputPath('like-pending.png') })
    expect(state.requests.filter(request => request.path.endsWith('/like'))).toHaveLength(1)
    release(); state.hold = null
    await expect(like).toHaveAccessibleName('Remove appreciation (1)')
    await expect(like).toBeEnabled()
    state.fail = 'DELETE'
    await like.click()
    await expect(comment.getByRole('alert')).toBeVisible()
    await expect(like).toHaveAccessibleName('Remove appreciation (1)')
    await expect(like).toHaveAttribute('aria-busy', 'false')
    await expect(like).toBeEnabled()
    await like.click()
    await expect(like).toHaveAccessibleName('Appreciate (0)')
    await expect(like).toBeEnabled()
  })
}

test('guest actions request sign-in while comments and replies remain readable', async ({ page }) => {
  const state = await fixture(page, { guest: true })
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: /^Comments \(/  }).click()
  const comment = page.locator('section article').first()
  await expect(comment.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(comment.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  await comment.getByRole('button', { name: 'Appreciate (0)' }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await page.getByRole('button', { name: 'Close sign-in dialog' }).click()
  await comment.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  expect(state.requests).toHaveLength(0)
})

test('compact comment dialog supports keyboard editing and reply actions', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await fixture(page)
  await page.goto('/author/writer')
  await page.getByRole('button', { name: 'Comments on Comment action testing' }).click()
  const dialog = page.getByRole('dialog', { name: 'Comments', exact: true })
  const comment = dialog.locator('article').first()
  await comment.getByRole('button', { name: 'Edit', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByLabel('Edit comment')).toBeFocused()
  await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByLabel('Edit comment').fill('Edited in compact dialog')
  await page.getByRole('dialog', { name: 'Edit comment', exact: true }).getByRole('button', { name: 'Save comment' }).click()
  await expect(comment.getByText('Edited in compact dialog', { exact: true })).toBeVisible()
  await comment.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(comment.getByLabel('Reply to Reader')).toBeFocused()
  await comment.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close comments' }).click()
  await expect(page.getByRole('button', { name: 'Comments on Comment action testing' })).toBeFocused()
})
