import { test, expect, setCheckbox } from './support/ui-test.js'

const post = { id: '507f1f77bcf86cd799439021', title: 'A focused idea', excerpt: 'A useful explanation.', author: { username: 'Other Writer', handle: 'other-writer' }, tags: ['science'], readTime: '1 min read', createdAt: '2026-09-08T00:00:00Z', likesCount: 0, commentsCount: 0 }
const collection = { id: '507f1f77bcf86cd799439030', title: 'Useful ideas', visibility: 'private', isOwner: true, postsCount: 0, posts: [] }
const visibleCollections = [collection, { ...collection, id: '507f1f77bcf86cd799439041', title: 'Public notes', visibility: 'public' }, { ...collection, id: '507f1f77bcf86cd799439042', title: 'Unlisted reading', visibility: 'unlisted' }]

async function mockApi(page, { guest = false, short = false, alreadyAdded = false } = {}) {
  const state = { writes: [], bookmarks: [], creations: [], reads: 0, empty: false, failAdd: false, failCreate: false, failList: false, hold: null, pending: null, holdBookmark: false, pendingBookmark: null, holdCreate: false, pendingCreate: null }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(guest ? { status: 401, json: { message: 'Signed out' } } : { json: { accessToken: 'collection-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
    if (path === `/api/post/${post.id}/bookmark`) {
      state.bookmarks.push(route.request().method())
      if (state.holdBookmark) await new Promise(resolve => { state.pendingBookmark = resolve })
      return route.fulfill({ json: { isBookmarked: route.request().method() === 'PUT' } })
    }
    if (path === `/api/v1/collections/${collection.id}/posts/${post.id}`) {
      state.writes.push(route.request().method())
      if (state.hold) await new Promise(resolve => { state.pending = resolve })
      return route.fulfill(state.failAdd ? { status: 400, json: { message: 'The story could not be added.' } } : { json: { data: { added: state.writes.length === 1 } } })
    }
    if (path === '/api/collection' && route.request().method() === 'POST') {
      state.creations.push(route.request().postDataJSON())
      if (state.holdCreate) await new Promise(resolve => { state.pendingCreate = resolve })
      return route.fulfill(state.failCreate ? { status: 400, json: { message: 'Creation failed. Try again.' } } : { status: 201, json: { data: { collectionId: collection.id } } })
    }
    if (path === '/api/collection') {
      state.reads += 1
      expect(url.searchParams.get('mine')).toBe('true')
      const firstPage = visibleCollections.map((item, index) => index === 0 && alreadyAdded ? { ...item, containsPost: true } : item)
      return route.fulfill(state.failList ? { status: 400, json: { message: 'Read failed' } } : { json: { data: state.empty ? [] : url.searchParams.has('cursor') ? [{ ...collection, id: '507f1f77bcf86cd799439040', title: 'Second page' }] : firstPage, meta: { nextCursor: state.empty || url.searchParams.has('cursor') ? null : 'next-page' } } })
    }
    if (path === `/api/post/${post.id}`) return route.fulfill({ json: { postData: { ...post, _id: post.id, format: short ? 'short' : 'article', body: JSON.stringify([{ id: 'text', type: 'text', content: post.excerpt }]) } } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: [post], shorts: [{ ...post, format: 'short' }], writers: [] } } })
    if (path === '/api/user/me/posts') return route.fulfill({ json: { data: [{ ...post, _id: post.id, publicationStatus: 'published', format: 'article' }] } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return state
}

test('save dialog identifies existing membership and prevents duplicate addition', async ({ page }) => {
  const state = await mockApi(page, { alreadyAdded: true })
  await page.goto(`/post/${post.id}`)
  await page.getByRole('button', { name: 'Save this story' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  const addToCollection = dialog.getByRole('checkbox', { name: 'Add to a collection' })
  await expect(addToCollection).toBeEnabled()
  await setCheckbox(addToCollection, true)
  await dialog.getByRole('combobox', { name: 'Choose one of your collections' }).click()
  const option = dialog.getByRole('option', { name: 'Useful ideas Private · Already added', exact: true })
  await expect(option).toBeVisible()
  await option.click()
  await expect(dialog.getByRole('button', { name: 'Already in collection', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
})

for (const width of [320, 1280]) {
  test(`card picks existing and creates a collection with the story at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const state = await mockApi(page)
    await page.goto('/search?q=science')
    const trigger = page.getByRole('button', { name: `More options for ${post.title}` }).first()
    const open = async () => { await trigger.click(); await page.getByRole('menuitem', { name: /^(Save story|Saved)$/ }).click() }
    await open()
    const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close save story' })).toBeFocused()
    await expect(dialog.getByRole('checkbox', { name: 'Save in your Library' })).toBeChecked()
    await dialog.getByText('Add to a collection', { exact: true }).click()
    const choice = dialog.getByRole('combobox', { name: 'Choose one of your collections' })
    await choice.click()
    const privateOption = dialog.getByRole('option', { name: 'Useful ideas Private', exact: true })
    await expect(privateOption).toBeVisible()
    await expect(privateOption.getByText('Private')).toHaveClass(/rounded-full/)
    await expect(dialog.getByRole('option', { name: 'Public notes Public', exact: true })).toBeVisible()
    await expect(dialog.getByRole('option', { name: 'Unlisted reading Unlisted', exact: true })).toBeVisible()
    await privateOption.click()
    await expect(choice).toContainText('Useful ideas')
    await expect(choice.getByText('Private')).toHaveClass(/rounded-full/)
    await choice.click()
    await expect(dialog.getByRole('option', { name: 'Second page Private', exact: true })).toBeVisible()
    await dialog.getByRole('option', { name: 'Useful ideas Private', exact: true }).click()
    state.failAdd = true
    await dialog.getByRole('button', { name: 'Save story', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be added')
    state.failAdd = false
    state.hold = true
    const target = dialog.getByRole('button', { name: 'Save story', exact: true })
    await target.click()
    await expect.poll(() => Boolean(state.pending)).toBe(true)
    await expect(target).toBeDisabled()
    await target.evaluate(element => element.click())
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    expect(state.writes).toEqual(['PUT', 'PUT'])
    state.pending()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(state.bookmarks).toContain('PUT')
    await open()
    await dialog.getByText('Add to a collection', { exact: true }).click()
    await dialog.getByRole('button', { name: 'Create new collection' }).click()
    await dialog.getByLabel('Title (required)', { exact: true }).fill('My reading list')
    await dialog.getByLabel('Description (optional)').fill('Collected from another writer')
    await dialog.getByRole('combobox', { name: 'Visibility' }).click()
    await dialog.getByRole('option', { name: 'Private', exact: true }).click()
    state.failCreate = true
    await dialog.getByRole('button', { name: 'Create collection', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Creation failed')
    await expect(dialog.getByLabel('Title (required)', { exact: true })).toHaveValue('My reading list')
    const box = await dialog.locator('section').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`create-${width}.png`) })
    state.failCreate = false
    state.holdCreate = true
    const create = dialog.getByRole('button', { name: 'Create collection', exact: true })
    await create.click()
    await expect.poll(() => Boolean(state.pendingCreate)).toBe(true)
    await expect(create).toBeDisabled()
    await create.evaluate(element => element.click())
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    expect(state.creations).toHaveLength(2)
    state.pendingCreate()
    await expect(dialog).toHaveCount(0)
    expect(state.creations.at(-1)).toEqual({ title: 'My reading list', description: 'Collected from another writer', visibility: 'private', postIds: [post.id] })
  })
}

test('save dialog supports Library only and collection only', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/search?q=science')
  const trigger = page.getByRole('button', { name: `More options for ${post.title}` }).first()
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Save story', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await expect(dialog.getByRole('checkbox', { name: 'Save in your Library' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Add to a collection' })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Save story', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.bookmarks).toEqual(['PUT'])
  expect(state.writes).toEqual([])
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Saved', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await setCheckbox(dialog.getByRole('checkbox', { name: 'Save in your Library' }), false)
  await setCheckbox(dialog.getByRole('checkbox', { name: 'Add to a collection' }), true)
  await dialog.getByRole('combobox', { name: 'Choose one of your collections' }).click()
  await dialog.getByRole('option', { name: 'Useful ideas Private', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save story', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes).toEqual(['PUT'])
  expect(state.bookmarks).toEqual(['PUT', 'DELETE'])
})

for (const theme of ['light', 'dark']) {
  test(`save choices use the app theme and retain keyboard checkbox behavior in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await mockApi(page)
    await page.goto(`/post/${post.id}`)
    await page.getByRole('button', { name: 'Save this story' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
    const library = dialog.getByRole('checkbox', { name: 'Save in your Library' })
    const collectionChoice = dialog.getByRole('checkbox', { name: 'Add to a collection' })
    const box = library.locator('..').locator('span[aria-hidden="true"]')
    const accent = await box.evaluate(element => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = 'var(--color-accent)'
      element.appendChild(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    await expect(library).toBeChecked()
    await expect(box).toHaveCSS('background-color', accent)
    await expect(box.locator('svg')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`save-choices-${theme}.png`) })
    await library.focus()
    await library.press('Space')
    await expect(library).not.toBeChecked()
    await expect(box.locator('svg')).toHaveCount(0)
    await collectionChoice.focus()
    await collectionChoice.press('Space')
    await expect(collectionChoice).toBeChecked()
    await expect(dialog.getByRole('combobox', { name: 'Choose one of your collections' })).toBeVisible()
  })
}

test('pending Library save keeps the dialog open and blocks repeat submission', async ({ page }) => {
  const state = await mockApi(page)
  state.holdBookmark = true
  await page.goto(`/post/${post.id}`)
  await page.getByRole('button', { name: 'Save this story' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  const save = dialog.getByRole('button', { name: 'Save story', exact: true })
  await save.click()
  await expect.poll(() => Boolean(state.pendingBookmark)).toBe(true)
  await expect(save).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.bookmarks).toEqual(['PUT'])
  state.pendingBookmark()
  await expect(dialog).toHaveCount(0)
})

for (const surface of ['article', 'short']) {
test(`${surface} opens the same save picker and restores focus`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    const state = await mockApi(page, { short: surface === 'short' })
    await page.goto(surface === 'writing' ? '/studio' : `/post/${post.id}`)
    const opener = page.getByRole('button', { name: surface === 'short' ? 'Save this short' : 'Save this story' })
    const trigger = opener
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    if (surface === 'short') {
      await expect(page.getByRole('dialog', { name: post.title, exact: true })).toBeVisible()
      await trigger.click()
      await dialog.getByText('Add to a collection', { exact: true }).click()
      await dialog.getByRole('button', { name: 'Create new collection' }).click()
      await dialog.getByLabel('Title (required)', { exact: true }).fill('Short ideas')
      await dialog.getByRole('button', { name: 'Create collection', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(state.creations.at(-1).postIds).toEqual([post.id])
      await expect(page.getByRole('dialog', { name: post.title, exact: true })).toBeVisible()
    }
  })
}

test('save dialog closes on outside click and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await mockApi(page)
  await page.goto(`/post/${post.id}`)
  const opener = page.getByRole('button', { name: 'Save this story' })
  await opener.click()
  let dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await setCheckbox(dialog.getByRole('checkbox', { name: 'Add to a collection' }), true)
  await dialog.getByRole('button', { name: 'Create new collection' }).click()
  await dialog.getByLabel('Title (required)', { exact: true }).fill('Unsaved list')
  await dialog.click({ position: { x: 2, y: 2 } })
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Title (required)', { exact: true })).toHaveCount(0)
})

test('guest save action opens sign-in without reading private collections', async ({ page }) => {
  const state = await mockApi(page, { guest: true })
  await page.goto('/search?q=science')
  await page.getByRole('button', { name: `More options for ${post.title}` }).first().click()
  await page.getByRole('menuitem', { name: 'Save story', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Save story', exact: true })).toHaveCount(0)
  expect(state.reads).toBe(0)
})

test('failed collection listing has retry and still permits creation', async ({ page }) => {
  const state = await mockApi(page)
  state.failList = true
  await page.goto(`/post/${post.id}`)
  await page.getByRole('button', { name: 'Save this story' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await setCheckbox(dialog.getByRole('checkbox', { name: 'Add to a collection' }), true)
  await expect(dialog.getByRole('alert')).toContainText('could not be loaded', { timeout: 10_000 })
  state.failList = false
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(dialog.getByRole('combobox', { name: 'Choose one of your collections' })).toBeVisible()
})

test('a user without collections can create one directly from a picked story', async ({ page }) => {
  const state = await mockApi(page)
  state.empty = true
  await page.goto(`/post/${post.id}`)
  await page.getByRole('button', { name: 'Save this story' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save story', exact: true })
  await setCheckbox(dialog.getByRole('checkbox', { name: 'Add to a collection' }), true)
  await expect(dialog.getByText('You have no collections yet.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Create new collection' }).click()
  await dialog.getByLabel('Title (required)', { exact: true }).fill('First collection')
  await dialog.getByRole('button', { name: 'Create collection', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.creations[0].postIds).toEqual([post.id])
})
