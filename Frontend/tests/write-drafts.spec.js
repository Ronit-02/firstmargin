import { test, expect } from '@playwright/test'

async function mockDrafts(page, { guest = false, failList = false, failCreate = false } = {}) {
  let authenticated = !guest
  let listError = failList
  let creationError = failCreate
  let releaseCreate
  let held = false
  let deletionError = false
  let holdDeletion = false
  let releaseDeletion
  const deleted = []
  const created = []
  const privateReads = []
  const records = [{ _id: 'existing-short', title: 'A saved short', format: 'short', updatedAt: '2026-10-12T08:00:00Z', tags: ['writing'], version: 1, blocks: [{ id: 'first', type: 'text', content: 'Saved short body' }] }]
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(authenticated ? { json: { accessToken: 'test', user: 'Writer', email: 'writer@example.test', role: 'regular' } } : { status: 401, json: {} })
    if (path === '/api/auth/login') { authenticated = true; return route.fulfill({ json: { token: 'test', username: 'Writer', email: 'writer@example.test', role: 'regular' } }) }
    if (path === '/api/v1/me/entitlements') { privateReads.push(path); return route.fulfill({ json: { data: { capabilities: [] } } }) }
    if (path === '/api/drafts' && request.method() === 'GET') {
      privateReads.push(path)
      return route.fulfill(listError ? { status: 500, json: {} } : { json: { data: records } })
    }
    if (path === '/api/drafts' && request.method() === 'POST') {
      created.push(request.postDataJSON())
      if (held) await new Promise(resolve => { releaseCreate = resolve })
      if (creationError) return route.fulfill({ status: 500, json: {} })
      const draft = { _id: 'new-draft', ...request.postDataJSON(), version: 1, updatedAt: '2026-10-12T09:00:00Z' }
      records.push(draft)
      return route.fulfill({ status: 201, json: { data: { id: draft._id, version: 1 } } })
    }
    if (path.startsWith('/api/drafts/') && request.method() === 'GET') {
      privateReads.push(path)
      return route.fulfill({ json: { data: records.find(record => record._id === path.split('/').at(-1)) } })
    }
    if (path.startsWith('/api/drafts/') && request.method() === 'PUT') {
      const record = records.find(record => record._id === path.split('/').at(-1))
      Object.assign(record, request.postDataJSON(), { version: record.version + 1 })
      return route.fulfill({ json: { data: { id: record._id, version: record.version } } })
    }
    if (path.startsWith('/api/drafts/') && request.method() === 'DELETE') {
      deleted.push(path.split('/').at(-1))
      if (holdDeletion) await new Promise(resolve => { releaseDeletion = resolve })
      if (deletionError) return route.fulfill({ status: 500, json: {} })
      const index = records.findIndex(record => record._id === deleted.at(-1))
      if (index !== -1) records.splice(index, 1)
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  return { created, privateReads, records, deleted, failDelete: () => { deletionError = true }, recoverDelete: () => { deletionError = false }, holdDelete: () => { holdDeletion = true }, releaseDelete: () => { holdDeletion = false; releaseDeletion?.() }, recoverList: () => { listError = false }, recoverCreate: () => { creationError = false }, holdCreate: () => { held = true }, releaseCreate: () => { held = false; releaseCreate?.() } }
}

for (const width of [320, 1280]) {
  for (const entry of ['/studio?writingTab=drafts']) {
    test(`draft deletion confirmation, recovery and empty state on ${entry} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 720 })
      await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
      const state = await mockDrafts(page)
      state.records.push({ ...state.records[0], _id: 'empty-article', title: '', format: 'article' })
      await page.goto(entry)
      const opener = page.getByRole('button', { name: 'Delete draft: A saved short', exact: true })
      const continueLink = page.getByRole('link', { name: 'Continue writing: A saved short' })
      const title = page.getByText('A saved short', { exact: true })
      const titleBounds = await title.boundingBox()
      const continueBounds = await continueLink.boundingBox()
      const deleteBounds = await opener.boundingBox()
      expect(continueBounds.x).toBeGreaterThan(titleBounds.x)
      expect(deleteBounds.x).toBeGreaterThan(continueBounds.x)
      expect(continueBounds.width).toBeGreaterThanOrEqual(44)
      expect(deleteBounds.width).toBeGreaterThanOrEqual(44)
      await expect(continueLink).toHaveText('')
      await expect(opener).toHaveText('')
      await opener.click()
      const dialog = page.getByRole('dialog', { name: 'Delete draft?', exact: true })
      await expect(dialog.getByRole('button', { name: 'Close draft deletion' })).toBeFocused()
      await dialog.getByRole('button', { name: 'Close draft deletion' }).click()
      await expect(opener).toBeFocused()
      expect(state.deleted).toEqual([])
      await opener.click()
      await page.keyboard.press('Escape')
      await expect(opener).toBeFocused()
      state.failDelete()
      await opener.click()
      await dialog.getByRole('button', { name: 'Delete draft', exact: true }).click()
      await expect(dialog.getByRole('alert')).toHaveText('The draft could not be deleted. Please try again.')
      await expect(page.getByRole('link', { name: 'Continue writing: A saved short' })).toBeVisible()
      state.recoverDelete()
      state.holdDelete()
      await dialog.getByRole('button', { name: 'Delete draft', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Delete draft', exact: true })).toBeDisabled()
      await page.keyboard.press('Escape')
      await dialog.getByRole('button', { name: 'Close draft deletion' }).click()
      await expect(dialog).toBeVisible()
      expect(state.deleted).toEqual(['existing-short', 'existing-short'])
      await page.screenshot({ path: testInfo.outputPath('draft-delete-pending.png') })
      state.releaseDelete()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Continue writing: A saved short' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Continue writing: Untitled draft' })).toBeFocused()
      expect(state.records).toHaveLength(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.reload()
      await expect(opener).toHaveCount(0)
      await page.getByRole('button', { name: 'Delete draft: Untitled draft' }).click()
      await expect(dialog).toContainText('Permanently delete “Untitled draft”?')
      await dialog.getByRole('button', { name: 'Delete draft', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByText('Your autosaved drafts will appear here.')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Drafts', exact: true })).toBeFocused()
      expect(state.deleted).toEqual(['existing-short', 'existing-short', 'empty-article'])
    })
  }
}

for (const width of [320, 1280]) {
  for (const format of ['article', 'short']) {
    test(`draft list and ${format} creation at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 820 })
      await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
      const state = await mockDrafts(page)
      await page.goto('/studio?writingTab=drafts')
      await expect(page.getByRole('link', { name: 'Continue writing: A saved short' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Paragraph block' })).toHaveCount(0)
      const start = page.getByRole('button', { name: 'Write a post', exact: true })
      await start.click()
      const choices = page.getByRole('dialog', { name: 'What do you want to write?' })
      await expect(choices).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(start).toBeFocused()
      expect(state.created).toHaveLength(0)
      await start.click()
      await page.screenshot({ path: testInfo.outputPath('type-chooser.png') })
      await choices.getByRole('button', { name: format === 'short' ? /^Short/ : /^Post/ }).click()
      await expect(page).toHaveURL(/studio\?draft=new-draft$/)
      const title = page.getByRole('textbox', { name: format === 'short' ? 'Short title' : 'Story title', exact: true })
      await expect(title).toBeVisible()
      expect(state.created).toHaveLength(1)
      expect(state.created[0]).toMatchObject({ format, title: '', tags: [] })
      expect(state.created[0].blocks).toHaveLength(1)
      await expect(page.locator('input[type=file]')).toHaveCount(0)
      await expect(page.getByRole('button', { name: '+ Add content' })).toHaveCount(0)
      await title.fill('My new draft')
      await page.getByRole('textbox', { name: 'Paragraph block', exact: true }).fill('A draft that persists and can be resumed.')
      await expect(page.getByRole('status').filter({ hasText: '✓ Saved' })).toBeVisible()
      await page.getByRole('button', { name: 'Publish', exact: true }).click()
      const publishDialog = page.getByRole('dialog', { name: format === 'short' ? 'Publish short' : 'Publish story' })
      await expect(publishDialog.locator('input[type=file]')).toHaveCount(format === 'short' ? 0 : 1)
      await publishDialog.getByRole('button', { name: 'Close publishing options' }).click()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page.getByRole('link', { name: 'Continue writing: My new draft' })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('draft-list.png') })
      await page.getByRole('link', { name: 'Continue writing: My new draft' }).click()
      await expect(title).toHaveValue('My new draft')
      await expect(page.getByRole('textbox', { name: 'Paragraph block', exact: true })).toHaveText('A draft that persists and can be resumed.')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}

test('draft reads and creation recover without duplicates or pending dismissal', async ({ page }) => {
  const state = await mockDrafts(page, { failList: true, failCreate: true })
  await page.goto('/studio?writingTab=drafts')
  await expect(page.getByRole('alert')).toContainText('Drafts could not be loaded.')
  state.recoverList()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('link', { name: 'Continue writing: A saved short' })).toBeVisible()
  await page.getByRole('button', { name: 'Write a post' }).click()
  const choices = page.getByRole('dialog', { name: 'What do you want to write?' })
  await choices.getByRole('button', { name: /^Short/ }).click()
  await expect(choices.getByRole('alert')).toHaveText('Your draft could not be created. Choose a type to try again.')
  state.recoverCreate()
  state.holdCreate()
  await choices.getByRole('button', { name: /^Short/ }).click()
  await expect(choices.getByRole('button', { name: /^Post/ })).toBeDisabled()
  await page.keyboard.press('Escape')
  await choices.getByRole('button', { name: 'Close writing choices' }).click()
  await expect(choices).toBeVisible()
  expect(state.created).toHaveLength(2)
  state.releaseCreate()
  await expect(page.getByRole('textbox', { name: 'Short title', exact: true })).toBeVisible()
  expect(state.records).toHaveLength(2)
})

test('guest studio is gated and saved drafts stay private', async ({ page }) => {
  const state = await mockDrafts(page, { guest: true })
  await page.goto('/studio')
  await expect(page.getByText('Sign in to manage your writing.')).toBeVisible()
  expect(state.created).toEqual([])
  expect(state.privateReads).toEqual([])
  await page.goto('/studio?draft=existing-short')
  await expect(page.getByText('Sign in to access your saved story.')).toBeVisible()
  expect(state.privateReads).toEqual([])
})

test('old writing URLs preserve draft and tab targets', async ({ page }) => {
  await mockDrafts(page)
  await page.goto('/write?draft=existing-short#chapter')
  await expect(page).toHaveURL('/studio?draft=existing-short#chapter')
  await expect(page.getByRole('textbox', { name: 'Short title', exact: true })).toHaveValue('A saved short')
  await page.goto('/writing?writingTab=drafts#chapter')
  await expect(page).toHaveURL('/studio?writingTab=drafts#chapter')
  await expect(page.getByRole('tab', { name: 'Drafts', exact: true })).toHaveAttribute('aria-selected', 'true')
})
