import { test, expect } from '@playwright/test'

async function mockProfile(page, { guest = false, failRead = false, writer = false } = {}) {
  let profile = { displayName: 'Maya Sen', bio: 'Writing about cities.', handle: 'maya-sen', joinedAt: '2025-01-01T00:00:00Z', writerStatus: writer ? 'writer' : 'reader', directRequestsEnabled: false, postCount: 0 }
  let failSave = !writer
  let readFailure = failRead
  const writes = []
  const interestWrites = []
  const avatarUploads = []
  let resets = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(guest ? { status: 401, json: { message: 'Signed out' } } : { json: { accessToken: 'profile-edit-fixture', user: 'Maya Sen', email: 'reader@example.test', role: 'regular' } })
    if (path === '/api/user/me') {
      if (readFailure) return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
      return route.fulfill({ json: { data: profile } })
    }
    if (path === '/api/user/profile') {
      const input = route.request().postDataJSON()
      writes.push(input)
      if (failSave) { failSave = false; return route.fulfill({ status: 400, json: { message: 'Name unavailable' } }) }
      profile = { ...profile, ...(input.username !== undefined && { displayName: input.username }), ...(input.bio !== undefined && { bio: input.bio }), ...(input.directRequestsEnabled !== undefined && { directRequestsEnabled: input.directRequestsEnabled }) }
      return route.fulfill({ json: { profile } })
    }
    if (path === '/api/user/profile/avatar') {
      avatarUploads.push(route.request().postDataBuffer())
      profile = { ...profile, avatarUrl: 'https://res.cloudinary.com/example/image/upload/v123/profile-avatars/user/new.png' }
      return route.fulfill({ json: { profile: { avatarUrl: profile.avatarUrl } } })
    }
    if (path === '/api/v1/onboarding') {
      if (route.request().method() === 'PUT') {
        interestWrites.push(route.request().postDataJSON())
        return route.fulfill({ json: { data: { selectedTopicSlugs: interestWrites.at(-1).topicSlugs, completed: true } } })
      }
      return route.fulfill({ json: { data: { topics: [{ slug: 'design', displayName: 'Design' }], selectedTopicSlugs: [], completed: true } } })
    }
    if (path === '/api/v1/interests/inferred') {
      resets += 1
      return route.fulfill({ json: { data: { reset: true } } })
    }
    if (path === '/api/v1/reading-history') return route.fulfill({ json: { data: { continueReading: [], history: [] } } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [], membership: { status: 'inactive' } } } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  return { writes, interestWrites, avatarUploads, get resets() { return resets }, recover: () => { readFailure = false } }
}

for (const width of [320, 1280]) {
  test(`Edit profile opens a page and preserves failed changes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    const calls = await mockProfile(page)
    await page.goto('/profile?profileTab=overview')
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
    await expect(page).toHaveURL(/\/profile\/edit\?profileTab=overview$/)
    await expect(page.getByRole('heading', { name: 'Edit profile', exact: true })).toBeVisible()
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByLabel('Display name')).toHaveValue('Maya Sen')
    await expect(page.getByLabel('Biography')).toHaveValue('Writing about cities.')
    await page.getByLabel('Display name').fill('Maya Updated')
    await page.getByLabel('Biography').fill('A new biography.')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Profile update failed' })).toBeVisible()
    await expect(page.getByLabel('Display name')).toHaveValue('Maya Updated')
    await expect(page.getByLabel('Biography')).toHaveValue('A new biography.')
    expect(await page.locator('[data-app-scroll]').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.screenshot({ path: `node_modules/.cache/profile-notifications/edit-${width}.png` })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/profile\?profileTab=overview$/)
    await expect(page.getByRole('heading', { name: 'Maya Updated', exact: true })).toBeVisible()
    expect(calls.writes).toEqual(Array(2).fill({ username: 'Maya Updated', bio: 'A new biography.' }))
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
    await page.getByLabel('Display name').fill('Discard me')
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Maya Updated', exact: true })).toBeVisible()
    expect(calls.writes).toHaveLength(2)
  })
}

test('direct edit entry recovers loading failures and Back falls back to Profile', async ({ page }) => {
  const calls = await mockProfile(page, { failRead: true })
  await page.goto('/profile/edit')
  await expect(page.getByRole('alert')).toHaveText('We couldn’t load your profile.')
  calls.recover()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Maya Sen')
  await page.getByLabel('Display name').fill('   ')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  expect(calls.writes).toHaveLength(0)
})

test('guest edit entry keeps private fields gated', async ({ page }) => {
  await mockProfile(page, { guest: true })
  await page.goto('/profile/edit')
  await expect(page.getByText('Sign in to edit your profile.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveCount(0)
  await page.getByRole('main').getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/profile\/edit$/)
})

test('one header Save applies staged interests and inferred reset', async ({ page }) => {
  const calls = await mockProfile(page)
  await page.goto('/profile/edit')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Save interests' })).toHaveCount(0)
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Reading interests' }) })).not.toHaveClass(/border-b/)
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Inferred interests' }) })).not.toHaveClass(/border-b/)
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await page.getByRole('button', { name: 'Reset inferred interests' }).click()
  expect(calls.interestWrites).toHaveLength(0)
  expect(calls.resets).toBe(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  expect(calls.writes).toHaveLength(0)
  expect(calls.interestWrites).toEqual([{ topicSlugs: ['design'], writerIds: [], completed: true }])
  expect(calls.resets).toBe(1)
})

test('writer stages member requests in Edit profile and Profile shows only the saved status', async ({ page }) => {
  const calls = await mockProfile(page, { writer: true })
  await page.goto('/profile')
  await expect(page.getByText('Member requests', { exact: true })).toBeVisible()
  await expect(page.getByText('Off', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
  await page.getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByText('Member requests are on and will update when you save.')).toBeVisible()
  expect(calls.writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByText('Off', { exact: true })).toBeVisible()
  expect(calls.writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
  await page.getByRole('button', { name: 'Turn on' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText('On', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn off' })).toHaveCount(0)
  expect(calls.writes).toEqual([{ directRequestsEnabled: true }])
})

test('profile picture is staged until Save and uploaded separately from profile text', async ({ page }) => {
  const calls = await mockProfile(page)
  await page.goto('/profile/edit')
  await page.getByLabel('Profile picture').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S0cAAAAASUVORK5CYII=', 'base64') })
  await expect(page.locator('img[src^="blob:"]')).toBeVisible()
  expect(calls.avatarUploads).toHaveLength(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  expect(calls.writes).toHaveLength(0)
  expect(calls.avatarUploads).toHaveLength(1)
})
