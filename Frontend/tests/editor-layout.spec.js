import { test, expect } from '@playwright/test'

async function mockEditor(page, { capabilities = [], saveStatus = 200, guest = false, loadedTitle = 'Existing draft', loadedFormat = 'short', loadedBlocks = [{ id: 'paragraph', type: 'text', content: 'Existing draft content.' }] } = {}) {
  let authenticated = !guest
  const privateRequests = []
  const saves = []
  const publications = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(authenticated ? { json: { accessToken: 'editor-test-token', user: 'Test Writer', email: 'writer@example.test', role: 'regular' } } : { status: 401, json: { message: 'Signed out' } })
    if (path === '/api/auth/login') { authenticated = true; return route.fulfill({ json: { token: 'editor-test-token', username: 'Test Writer', email: 'writer@example.test', role: 'regular' } }) }
    if (path.startsWith('/api/drafts') || path === '/api/v1/me/entitlements' || path === '/api/post/depth-options' || path === '/api/post/' && request.method() === 'POST') privateRequests.push(path)
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities } } })
    if (path.startsWith('/api/drafts') && ['POST', 'PUT'].includes(request.method())) {
      saves.push(request.postDataJSON())
      return route.fulfill({ status: saveStatus, json: saveStatus === 200 ? { data: { id: 'draft-layout', version: saves.length } } : { message: 'Save unavailable' } })
    }
    if (path === '/api/drafts/draft-layout' && request.method() === 'GET') return route.fulfill({ json: { data: { title: loadedTitle, blocks: loadedBlocks, tags: ['writing'], format: loadedFormat, version: 1 } } })
    if (path === '/api/post/' && request.method() === 'POST') {
      publications.push(request.postData())
      return route.fulfill({ status: 400, json: { message: 'Publication test: draft preserved.' } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return { saves, publications, privateRequests }
}

for (const size of [{ width: 320, height: 735 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
  test(`stacked post fields and block actions at ${size.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(size)
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), size.width < 640 ? 'light' : 'dark')
    const { saves, publications } = await mockEditor(page)
    await page.goto('/studio?new=article')
    const title = page.getByRole('textbox', { name: 'Story title', exact: true })
    const body = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await expect(title).toBeVisible()
    const [titleBounds, bodyBounds] = await Promise.all([title.boundingBox(), body.boundingBox()])
    expect(bodyBounds.x).toBe(titleBounds.x)
    expect(bodyBounds.width).toBe(titleBounds.width)
    expect(titleBounds.y + titleBounds.height).toBeLessThan(bodyBounds.y)
    await expect(page.getByRole('button', { name: '+ Add content', exact: true })).toHaveCount(0)
    await body.fill('This is a story that stays safe through autosave and publication failure.')
    if (size.width < 1024) {
      const add = page.getByRole('button', { name: 'Add block after this block', exact: true })
      const remove = page.getByRole('button', { name: 'Delete text block', exact: true })
      const [addBox, removeBox, fieldBox] = await Promise.all([add.boundingBox(), remove.boundingBox(), body.boundingBox()])
      const lineHeight = await body.evaluate(field => Number.parseFloat(getComputedStyle(field).lineHeight))
      await expect(page.getByRole('region', { name: 'Writing area' })).toHaveCSS('padding-left', '24px')
      expect(addBox.x + addBox.width).toBeLessThanOrEqual(fieldBox.x + 13)
      expect(removeBox.x).toBeGreaterThanOrEqual(fieldBox.x + fieldBox.width - 13)
      expect(Math.abs(addBox.y + addBox.height / 2 - (fieldBox.y + lineHeight / 2))).toBeLessThanOrEqual(4)
      expect(Math.abs(removeBox.y - addBox.y)).toBeLessThanOrEqual(1)
      expect(addBox.x).toBeGreaterThanOrEqual(0)
      expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(size.width)
      await add.click()
      if (size.width < 768) {
        const sheet = page.getByRole('dialog', { name: 'Insert block', exact: true })
        await sheet.getByRole('button', { name: 'Text', exact: true }).click()
      } else {
        await expect(page.getByRole('dialog', { name: 'Insert block', exact: true })).toHaveCount(0)
        await page.getByRole('listbox', { name: 'Insert block' }).getByRole('option', { name: 'Insert Text', exact: true }).click()
      }
      await expect(page.getByRole('textbox', { name: 'Paragraph block', exact: true }).last()).toBeFocused()
      await page.getByRole('button', { name: 'Delete text block', exact: true }).last().click()
    } else {
      const add = page.getByRole('button', { name: 'Add block after this block', exact: true })
      const remove = page.getByRole('button', { name: 'Delete text block', exact: true })
      await expect(add).toBeVisible()
      await expect(remove).toBeVisible()
      await add.click()
      await page.getByRole('option', { name: 'Insert Text', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Paragraph block', exact: true }).last()).toBeFocused()
      await page.getByRole('button', { name: 'Delete text block', exact: true }).last().click()
    }
    await expect(body).toHaveCount(1)
    await title.fill('A post draft')
    await expect.poll(() => saves.some(save => save.title === 'A post draft')).toBe(true)
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('#main-content').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: testInfo.outputPath('editor-layout.png'), fullPage: true })
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Publish story' })
    await dialog.getByLabel('Add a tag', { exact: true }).fill('writing')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await dialog.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ94AAAAASUVORK5CYII=', 'base64') })
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'Publication test: draft preserved.' })).toBeVisible()
    expect(publications).toHaveLength(1)
    await expect(title).toHaveValue('A post draft')
  })
}

test('blank writing space focuses the nearest editable line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockEditor(page)
  await page.goto('/studio?new=article')
  const area = page.getByRole('region', { name: 'Writing area' })
  const title = page.getByRole('textbox', { name: 'Story title', exact: true })
  const paragraph = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await expect(area).toHaveCSS('cursor', 'text')
  await area.getByText('Story', { exact: true }).click()
  await expect(paragraph).toBeFocused()
  const bounds = await area.boundingBox()
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8)
  await expect(paragraph).toBeFocused()
  await title.click()
  await expect(title).toBeFocused()
})

test('phone block sheet stays usable on a short viewport and restores focus', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 360 })
  await mockEditor(page)
  await page.goto('/studio?new=short')
  const body = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await body.fill('Keep this idea while choosing a block.')
  const trigger = page.getByRole('button', { name: 'Add block after this block', exact: true })
  await trigger.click()
  const sheet = page.getByRole('dialog', { name: 'Insert block', exact: true })
  await expect(sheet.getByRole('button', { name: 'Text', exact: true })).toBeFocused()
  await sheet.getByRole('button', { name: 'Divider', exact: true }).scrollIntoViewIfNeeded()
  const bounds = await sheet.getByRole('button', { name: 'Divider', exact: true }).boundingBox()
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(360)
  await page.screenshot({ path: testInfo.outputPath('phone-block-sheet.png') })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(body).toHaveText('Keep this idea while choosing a block.')
})

for (const width of [320, 390]) {
  test(`short word count sits close above mobile navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 735 })
    await mockEditor(page)
    await page.goto('/studio?new=short')
    const count = page.getByText('0/500 words', { exact: true })
    await page.locator('#main-content').evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(count).toBeInViewport()
    const [countBox, navBox] = await Promise.all([count.boundingBox(), page.getByRole('navigation', { name: 'Mobile primary navigation' }).boundingBox()])
    const gap = navBox.y - (countBox.y + countBox.height)
    expect(gap).toBeGreaterThanOrEqual(8)
    expect(gap).toBeLessThanOrEqual(28)
  })
}

for (const width of [320, 768]) {
  test(`editor heading and selection toolbar stay clear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 })
    await mockEditor(page)
    await page.goto('/studio?new=article')
    const heading = page.getByRole('heading', { name: 'Write Story', exact: true })
    const editing = page.getByText('Editing', { exact: true })
    const actions = page.getByRole('button', { name: 'Instructions', exact: true })
    const [headingBox, editingBox, actionsBox] = await Promise.all([heading.boundingBox(), editing.boundingBox(), actions.boundingBox()])
    expect(headingBox.height).toBeLessThan(40)
    expect(editingBox.height).toBeLessThan(20)
    if (width === 320) expect(actionsBox.y).toBeGreaterThan(headingBox.y + headingBox.height)

    const field = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await field.fill('Selected words in the story')
    await field.evaluate(element => {
      const range = document.createRange()
      range.setStart(element.firstChild, 0)
      range.setEnd(element.firstChild, 8)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    const toolbar = page.getByRole('toolbar', { name: 'Format selected text' })
    if (width === 320) {
      await expect(page.getByRole('toolbar', { name: 'Editor commands' }).getByRole('button', { name: 'Bold selected text' })).toBeEnabled()
      await expect(page.locator('[data-selection-toolbar]')).toBeHidden()
      return
    }
    await expect(toolbar).toBeVisible()
    const [labelBox, toolbarBox] = await Promise.all([page.getByText('Story', { exact: true }).boundingBox(), toolbar.boundingBox()])
    expect(toolbarBox.y >= labelBox.y + labelBox.height || toolbarBox.y + toolbarBox.height <= labelBox.y).toBe(true)
  })
}

for (const width of [768, 1280, 1920]) {
  test(`word count has a small bottom gap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockEditor(page)
    await page.goto('/studio?new=short')
    const frame = page.locator('[data-page-frame]')
    const count = page.getByText('0/500 words', { exact: true })
    const [frameBox, countBox] = await Promise.all([frame.boundingBox(), count.boundingBox()])
    expect(frameBox.y + frameBox.height - countBox.y - countBox.height).toBeLessThanOrEqual(12)
  })
}

test('desktop formatting uses the slash menu alongside block buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockEditor(page)
  await page.goto('/studio?new=short')
  const body = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await body.focus()
  await expect(page.getByRole('button', { name: 'Add block after this block', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete text block', exact: true })).toBeVisible()
  await body.fill('/')
  await expect(page.getByRole('option', { name: 'Insert Text', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(body).toBeFocused()
})

test('desktop hover reveals a row marker and its block controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockEditor(page)
  await page.goto('/studio?new=short')
  const paragraphs = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await paragraphs.first().focus()
  await paragraphs.first().press('Enter')
  await paragraphs.first().focus()
  const secondRow = page.locator('[data-editor-block]').nth(1)
  const controls = secondRow.locator('[data-editor-block-controls]')
  await expect(controls).toHaveCSS('opacity', '0')
  await paragraphs.last().hover()
  await expect(controls).toHaveCSS('opacity', '1')
  await expect.poll(() => secondRow.evaluate(row => getComputedStyle(row, '::before').width)).toBe('2px')
  await secondRow.getByRole('button', { name: 'Add block after this block' }).click()
  await page.getByRole('option', { name: 'Insert Text', exact: true }).click()
  await expect(paragraphs).toHaveCount(3)
})

for (const width of [320, 1280]) {
  test(`slash hint appears only in the focused paragraph at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 735 })
    await mockEditor(page)
    await page.goto('/studio?new=short')
    const paragraphs = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    const hint = field => field.locator('xpath=following-sibling::span[1]')
    await expect(hint(paragraphs.first())).toBeHidden()
    await paragraphs.first().focus()
    await expect(hint(paragraphs.first())).toBeVisible()
    await paragraphs.first().press('Enter')
    await expect(paragraphs).toHaveCount(2)
    await expect(paragraphs.last()).toBeFocused()
    await expect(hint(paragraphs.first())).toBeHidden()
    await expect(hint(paragraphs.last())).toBeVisible()
    await page.getByRole('textbox', { name: 'Short title', exact: true }).focus()
    await expect(hint(paragraphs.last())).toBeHidden()
  })
}

for (const width of [320, 390, 768]) {
  test(`empty story row can regain focus by clicking its first line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 735 })
    await mockEditor(page)
    await page.goto('/studio?new=short')
    const story = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await story.focus()
    await page.getByRole('textbox', { name: 'Short title', exact: true }).focus()
    const bounds = await story.boundingBox()
    await story.click({ position: { x: bounds.width / 2, y: 12 } })
    await expect(story).toBeFocused()
    await story.fill('The row remains editable.')
    await expect(story).toHaveText('The row remains editable.')
  })
}

test('member release settings remain available without writing assistance', async ({ page }) => {
  const assistantRequests = []
  page.on('request', request => { if (request.url().includes('/writing-assistant')) assistantRequests.push(request.url()) })
  await page.setViewportSize({ width: 320, height: 568 })
  await mockEditor(page, { capabilities: ['early_access', 'ai_writing_assistant'] })
  await page.goto('/studio?new=article')
  await page.getByRole('textbox', { name: 'Paragraph block', exact: true }).fill('Your writing stays in the editor.')
  await page.getByRole('textbox', { name: 'Story title', exact: true }).fill('Release settings')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByLabel('Public release')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Writing assistant', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open assistant', exact: true })).toHaveCount(0)
  expect(assistantRequests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('optional cover removal keeps article ready to publish', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockEditor(page)
  await page.goto('/studio?new=article')
  await page.getByRole('textbox', { name: 'Story title', exact: true }).fill('An article')
  await page.getByRole('textbox', { name: 'Paragraph block', exact: true }).fill('Article body.')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Publish story' })
  await dialog.getByLabel('Add a tag', { exact: true }).fill('writing')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await dialog.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ94AAAAASUVORK5CYII=', 'base64') })
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Remove cover image' }).click()
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: '+ Add cover image', exact: true })).toBeVisible()
})

test('draft load and save failures keep visible recovery feedback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 735 })
  await mockEditor(page, { saveStatus: 409 })
  await page.goto('/studio?draft=draft-layout')
  await expect(page.getByRole('textbox', { name: 'Short title', exact: true })).toHaveValue('Existing draft')
  await expect(page.getByRole('textbox', { name: 'Paragraph block', exact: true })).toHaveText('Existing draft content.')
  await page.getByRole('textbox', { name: 'Short title', exact: true }).fill('Edited draft')
  await expect(page.getByRole('alert').filter({ hasText: 'This draft changed in another tab.' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Draft conflict' })).toBeVisible()
})

for (const format of ['short', 'article']) {
  test(`loaded ${format} title expands to show wrapped lines`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 735 })
    const loadedTitle = 'A long title that wraps across two lines when this saved story is opened for editing'
    await mockEditor(page, { loadedTitle, loadedFormat: format })
    await page.goto('/studio?draft=draft-layout')
    const title = page.getByRole('textbox', { name: format === 'short' ? 'Short title' : 'Story title', exact: true })
    await expect(title).toHaveValue(loadedTitle)
    await expect.poll(() => title.evaluate(field => field.clientHeight >= field.scrollHeight)).toBe(true)
  })
}

for (const width of [320, 1280]) {
  test(`deleting a block focuses the adjacent writing field at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockEditor(page, { loadedBlocks: [
      { id: 'first', type: 'text', content: 'First paragraph' },
      { id: 'second', type: 'text', content: 'Second paragraph' },
      { id: 'third', type: 'text', content: 'Third paragraph' },
    ] })
    await page.goto('/studio?draft=draft-layout')
    const fields = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await expect(fields).toHaveCount(3)
    await fields.last().focus()
    await page.getByRole('button', { name: 'Delete text block' }).last().click()
    await expect(fields).toHaveCount(2)
    await expect(fields.last()).toBeFocused()
    const caretOffset = field => field.evaluate(element => {
      const selection = window.getSelection()
      const beforeCaret = document.createRange()
      beforeCaret.selectNodeContents(element)
      beforeCaret.setEnd(selection.anchorNode, selection.anchorOffset)
      return beforeCaret.toString().length
    })
    await expect.poll(() => caretOffset(fields.last())).toBe('Second paragraph'.length)
    await fields.first().focus()
    await page.getByRole('button', { name: 'Delete text block' }).first().click()
    await expect(fields).toHaveCount(1)
    await expect(fields.first()).toBeFocused()
    await expect.poll(() => caretOffset(fields.first())).toBe(0)
    await page.getByRole('button', { name: 'Delete text block' }).click()
    await expect(fields).toHaveCount(1)
    await expect(fields.first()).toBeFocused()
    await expect(fields.first()).toHaveText('')
  })

  test(`deleting a quote places the caret before empty field hints at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    for (const type of ['text', 'h1', 'h2', 'h3', 'quote', 'code', 'image']) {
      await mockEditor(page, { loadedBlocks: [
        { id: 'empty', type, content: '' },
        { id: 'remove', type: 'quote', content: 'Remove this quote' },
      ] })
      await page.goto('/studio?draft=draft-layout')
      const field = page.getByRole('textbox', { name: `${type === 'text' ? 'Paragraph' : type} block`, exact: true }).first()
      await page.getByRole('textbox', { name: 'quote block', exact: true }).last().focus()
      await page.getByRole('button', { name: 'Delete quote block' }).last().click()
      await expect(field).toBeFocused()
      if (['code', 'image'].includes(type)) {
        await expect.poll(() => field.evaluate(element => element.selectionStart)).toBe(0)
      } else {
        await expect.poll(() => field.evaluate(element => {
          const selection = window.getSelection()
          return (element === selection.anchorNode || element.contains(selection.anchorNode)) && selection.anchorOffset === 0
        })).toBe(true)
        await expect(field.locator('xpath=following-sibling::span[1]')).toBeVisible()
      }
      if (type === 'quote') await page.screenshot({ path: testInfo.outputPath('empty-quote-after-delete.png') })
    }
  })

  test(`empty final rich-text block keeps its slash hint at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await mockEditor(page, { loadedBlocks: [{ id: 'paragraph', type: 'text', content: 'Existing draft content.   ' }] })
    await page.goto('/studio?draft=draft-layout')
    const fields = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await fields.first().focus()
    await fields.first().evaluate(field => {
      const range = document.createRange()
      range.setStart(field.firstChild, 'Existing draft content.'.length)
      range.collapse(true)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await fields.first().press('Enter')
    await expect(fields).toHaveCount(2)
    const last = fields.last()
    await expect(last).toBeFocused()
    await expect.poll(() => last.evaluate(field => field.textContent)).toBe('   ')
    await expect(last).toHaveAttribute('data-empty', 'true')
    const hint = last.locator('xpath=following-sibling::span[1]')
    await expect(hint).toBeVisible()
    await expect(hint).toHaveText('Press / for formatting options')
    await page.screenshot({ path: testInfo.outputPath('after-enter-page.png') })
    await last.evaluate(field => { field.innerHTML = '<br>' })
    await expect(last).toHaveAttribute('data-empty', 'true')
    await expect(hint).toBeVisible()
    await last.press('/')
    await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeVisible()
  })

  test(`rich text arrows move through lines and across blocks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockEditor(page, { loadedBlocks: [
      { id: 'first', type: 'text', content: 'first line\nsecond line\nthird line' },
      { id: 'second', type: 'text', content: 'next block' },
    ] })
    await page.goto('/studio?draft=draft-layout')
    const fields = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await expect(fields).toHaveCount(2)
    await fields.first().focus()
    await fields.first().evaluate(field => {
      const range = document.createRange()
      range.setStart(field.firstChild, 14)
      range.collapse(true)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await fields.first().press('ArrowUp')
    await expect(fields.first()).toBeFocused()
    await fields.first().press('ArrowDown')
    await expect(fields.first()).toBeFocused()
    await fields.first().press('ControlOrMeta+End')
    await fields.first().press('ArrowDown')
    await expect(fields.last()).toBeFocused()
    await expect.poll(() => fields.last().evaluate(() => window.getSelection().anchorOffset)).toBe('third line'.length)
    await fields.last().press('ControlOrMeta+Home')
    await fields.last().press('ArrowUp')
    await expect(fields.first()).toBeFocused()
    await expect.poll(() => fields.first().evaluate(field => {
      const selection = window.getSelection()
      const beforeCaret = document.createRange()
      beforeCaret.selectNodeContents(field)
      beforeCaret.setEnd(selection.anchorNode, selection.anchorOffset)
      return beforeCaret.toString().length
    })).toBe('first line\nsecond line\nthird line'.length - 'third line'.length)
    await fields.first().evaluate(field => {
      const range = document.createRange()
      range.setStart(field.lastChild, 4)
      range.collapse(true)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await fields.first().press('ArrowDown')
    await expect(fields.last()).toBeFocused()
    await expect.poll(() => fields.last().evaluate(() => window.getSelection().anchorOffset)).toBe(4)
    await fields.last().press('ArrowUp')
    await expect(fields.first()).toBeFocused()
    await expect.poll(() => fields.first().evaluate(() => window.getSelection().anchorOffset)).toBe(4)
  })

  test(`rich text arrows keep the nearest visual line across wrapped blocks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockEditor(page, { loadedBlocks: [
      { id: 'first', type: 'text', content: 'A long paragraph that wraps onto multiple visible lines in the editor' },
      { id: 'second', type: 'text', content: 'Another long paragraph that also wraps onto multiple visible lines' },
    ] })
    await page.goto('/studio?draft=draft-layout')
    const fields = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await expect(fields).toHaveCount(2)
    await fields.evaluateAll(elements => elements.forEach(field => { field.style.width = '160px' }))
    await fields.last().focus()
    await fields.last().press('ControlOrMeta+Home')
    await fields.last().press('ArrowUp')
    await expect(fields.first()).toBeFocused()
    await expect.poll(() => fields.first().evaluate(field => {
      const selection = window.getSelection()
      const caret = selection.getRangeAt(0).getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(field)
      return caret.top > range.getBoundingClientRect().top + 20
    })).toBe(true)
    await fields.first().press('ControlOrMeta+End')
    await fields.first().press('ArrowDown')
    await expect(fields.last()).toBeFocused()
    await expect.poll(() => fields.last().evaluate(field => {
      const selection = window.getSelection()
      const caret = selection.getRangeAt(0).getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(field)
      return caret.top < range.getBoundingClientRect().bottom - 40
    })).toBe(true)
  })

  test(`guest writing survives Publish authentication without anonymous saves at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 735 })
    const { saves, publications, privateRequests } = await mockEditor(page, { guest: true })
    const origin = '/studio?question=reader-question&new=short#draft'
    await page.goto(origin)
    const publish = page.getByRole('button', { name: 'Publish', exact: true })
    const dialog = page.getByRole('dialog', { name: 'Sign in to firstmargin' })
    await expect(page.getByRole('heading', { name: 'Write Short', exact: true })).toBeVisible()
    await expect(page.getByText('Editing', { exact: true })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(publish).toBeDisabled()
    const title = page.getByRole('textbox', { name: 'Short title', exact: true })
    const body = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    await title.fill('Guest writing stays here')
    await body.fill('My writing should survive authentication and become an authenticated draft.')
    await expect(publish).toBeEnabled()
    // Wait beyond the authenticated autosave delay to prove guests stay local.
    await expect(async () => {
      await expect(page.getByText('Sign in to save your draft.', { exact: true })).toBeVisible()
      expect(privateRequests).toEqual([])
    }).toPass({ timeout: 3000 })
    await page.waitForTimeout(1700)
    expect(privateRequests).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('guest-editor.png') })
    await publish.click()
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(origin)
    await dialog.getByRole('button', { name: 'Close sign-in dialog' }).click()
    await expect(title).toHaveValue('Guest writing stays here')
    await expect(body).toHaveText('My writing should survive authentication and become an authenticated draft.')
    await expect(page.locator('input[type=file]')).toHaveCount(0)
    expect(publications).toEqual([])
    await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { message: 'Unable to sign in.' } }), { times: 1 })
    await publish.click()
    await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('writer@example.test')
    await dialog.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
    await dialog.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Unable to sign in.')
    expect(privateRequests).toEqual([])
    await dialog.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(title).toHaveValue('Guest writing stays here')
    await expect(body).toHaveText('My writing should survive authentication and become an authenticated draft.')
    await expect(page.locator('input[type=file]')).toHaveCount(0)
    await expect.poll(() => saves.some(save => save.title === 'Guest writing stays here')).toBe(true)
    expect(publications).toEqual([])
    await expect(page).toHaveURL(/\/studio\?question=reader-question&new=short&draft=draft-layout#draft$/)
    await publish.click()
    const publishDialog = page.getByRole('dialog', { name: 'Publish short' })
    await publishDialog.getByLabel('Add a tag', { exact: true }).fill('writing')
    await publishDialog.getByRole('button', { name: 'Add', exact: true }).click()
    await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(publishDialog.getByRole('alert').filter({ hasText: 'Publication test: draft preserved.' })).toBeVisible()
    expect(publications).toHaveLength(1)
    expect(publications[0]).toContain('Guest writing stays here')
    expect(publications[0]).toContain('reader-question')
  })
}
