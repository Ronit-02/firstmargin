import { test, expect } from './support/ui-test.js'

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S0cAAAAASUVORK5CYII=', 'base64')
const original = 'https://images.example.test/original.png'
const uploaded = 'https://images.example.test/uploaded.png'
const pasted = 'https://images.example.test/pasted.png'

async function mockCover(page, { failSave = false } = {}) {
  let profile = { id: '507f1f77bcf86cd799439011', displayName: 'Maya Sen', bio: 'Writing about cities.', handle: 'maya-sen', joinedAt: '2025-01-01T00:00:00Z', writerStatus: 'writer', coverImageUrl: original, posts: [], followersCount: 3, followingCount: 2, postCount: 0, isSelf: true }
  const writes = []
  let textWrites = 0
  await page.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/png', body: pixel }))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'cover-fixture', user: 'Maya Sen', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/user/me' || path === '/api/writer/maya-sen') return route.fulfill({ json: { data: profile } })
    if (path === '/api/user/profile/cover') {
      const body = route.request().postDataBuffer().toString()
      writes.push(body)
      await new Promise(resolve => setTimeout(resolve, 250))
      if (failSave) { failSave = false; return route.fulfill({ status: 500, json: { message: 'Unavailable' } }) }
      const coverImageUrl = body.includes('name="removeCover"') ? null : body.includes('name="coverImageUrl"') ? pasted : uploaded
      profile = { ...profile, coverImageUrl }
      return route.fulfill({ json: { profile: { coverImageUrl } } })
    }
    if (path === '/api/user/profile') textWrites++
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: [], writers: [], selectedTopicSlugs: [], completed: true } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [], membership: { status: 'inactive' } } } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  return { writes, get textWrites() { return textWrites } }
}

for (const width of [320, 1280]) {
  test(`profile cover previews, cancels, retries and persists on both profile views at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const calls = await mockCover(page, { failSave: true })
    await page.goto('/profile')
    await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', original)
    const identity = page.getByRole('main').locator('header').filter({ has: page.getByRole('heading', { name: 'Maya Sen', exact: true }) })
    const coverBounds = await page.getByRole('img', { name: 'Profile cover', exact: true }).boundingBox()
    const avatarBounds = await identity.getByRole('img', { name: 'Maya Sen avatar', exact: true }).boundingBox()
    const nameBounds = await identity.getByRole('heading', { name: 'Maya Sen', exact: true }).boundingBox()
    const bioBounds = await identity.getByText('Writing about cities.', { exact: true }).boundingBox()
    expect(avatarBounds.width).toBe(96)
    expect(avatarBounds.y).toBeLessThan(coverBounds.y + coverBounds.height)
    expect(avatarBounds.y + avatarBounds.height).toBeGreaterThan(coverBounds.y + coverBounds.height)
    expect(bioBounds.y).toBeGreaterThan(avatarBounds.y + avatarBounds.height)
    expect(bioBounds.y).toBeGreaterThan(nameBounds.y + nameBounds.height)
    if (width >= 768) expect(nameBounds.x).toBeGreaterThan(avatarBounds.x + avatarBounds.width)
    expect(await page.getByRole('main').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('profile-identity.png') })
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
    await page.getByLabel('Biography', { exact: false }).fill('Unsaved biography')
    const trigger = page.getByRole('button', { name: 'Edit cover image', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Cover image', exact: true })
    const input = dialog.getByLabel('Cover image file', { exact: true })
    const file = { name: 'cover.png', mimeType: 'image/png', buffer: pixel }
    await input.setInputFiles(file)
    await expect(dialog.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', /^blob:/)
    expect(calls.writes).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Close cover image' }).click()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(dialog.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', original)
    await input.setInputFiles(file)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('alert')).toContainText('Cover image could not be saved.')
    await expect(dialog.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', /^blob:/)
    await page.screenshot({ path: testInfo.outputPath('cover-preview.png') })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByLabel('Biography', { exact: false })).toHaveValue('Unsaved biography')
    expect(calls.textWrites).toBe(0)
    expect(calls.writes).toHaveLength(2)
    expect(calls.writes[1]).toContain('name="coverImage"; filename="cover.png"')
    await page.goto('/profile')
    await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', uploaded)
    await page.reload()
    await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', uploaded)
    await page.goto('/author/maya-sen')
    await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', uploaded)
    expect(await page.getByRole('main').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  })
}

test('profile cover supports URL replacement, removal and invalid-file feedback', async ({ page }) => {
  const calls = await mockCover(page)
  await page.goto('/profile/edit')
  const trigger = page.getByRole('button', { name: 'Edit cover image', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Cover image', exact: true })
  await dialog.getByLabel('Cover image file').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('Invalid file') })
  await expect(dialog.getByRole('alert')).toContainText('Choose a JPG, PNG, WebP, or GIF')
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await dialog.getByRole('combobox', { name: 'Image source' }).click()
  await dialog.getByRole('option', { name: 'Paste URL', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Cover image URL', exact: true }).fill('javascript:invalid')
  await expect(dialog.getByRole('img', { name: 'Profile cover', exact: true })).toHaveAttribute('src', original)
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Cover image URL', exact: true }).fill(pasted)
  expect(calls.writes).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.writes[0]).toContain('name="coverImageUrl"')
  await trigger.click()
  await dialog.getByRole('button', { name: 'Remove cover image', exact: true }).click()
  await expect(dialog.getByRole('img', { name: 'Profile cover', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.writes[1]).toContain('name="removeCover"')
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveCount(0)
  await page.goto('/author/maya-sen')
  await expect(page.getByRole('img', { name: 'Profile cover', exact: true })).toHaveCount(0)
})
