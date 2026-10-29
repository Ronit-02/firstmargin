import { test, expect } from './support/ui-test.js'

const session = { token: 'sheet-token', username: 'Priya Mehta', email: 'reader@example.test', role: 'regular' }

async function mockApi(page, initiallySignedIn = false) {
  let signedIn = initiallySignedIn
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { accessToken: session.token, user: session.username, email: session.email, role: session.role } : { message: 'Signed out' } })
    if (path === '/api/auth/login') { signedIn = true; return route.fulfill({ json: session }) }
    if (path === '/api/auth/logout') { signedIn = false; return route.fulfill({ json: { message: 'Signed out' } }) }
    if (path === '/api/v1/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } })
    if (path === '/api/v1/onboarding') return route.fulfill({ json: { data: { topics: [], selectedTopicSlugs: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
}

for (const size of [{ width: 320, height: 480 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 600, height: 800 }, { width: 767, height: 800 }, { width: 767, height: 360 }]) {
  test(`profile sheet fits and contains focus at ${size.width}x${size.height}`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize(size)
    await page.goto('/shorts')
    const nav = page.getByRole('navigation', { name: 'Mobile primary navigation' })
    await expect(nav.getByRole('link', { name: 'Write' })).toHaveCount(0)
    const trigger = nav.getByRole('button', { name: 'Account' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Account', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Sign Up' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Member Hub', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/')
    await expect(dialog.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/')
    await dialog.getByRole('button', { name: 'Help', exact: true }).click()
    await expect(dialog.getByRole('region', { name: 'Help', exact: true })).toBeVisible()
    await dialog.getByRole('link', { name: 'LinkedIn' }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole('link', { name: 'LinkedIn' })).toBeInViewport()
    await expect.poll(async () => {
      const bounds = await dialog.locator('[data-profile-sheet]').boundingBox()
      return Math.round(bounds.y + bounds.height)
    }).toBe(size.height)
    const bounds = await dialog.locator('[data-profile-sheet]').boundingBox()
    expect(bounds.y).toBeGreaterThanOrEqual(15)
    expect(bounds.width).toBe(Math.min(size.width, 480))
    expect(Math.abs(bounds.x - (size.width - bounds.width) / 2)).toBeLessThan(1)
    await dialog.getByRole('link', { name: 'LinkedIn' }).focus()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Close account menu' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('link', { name: 'LinkedIn' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page).toHaveURL(/\/shorts$/)
    await trigger.click()
    await dialog.getByRole('button', { name: 'Close account menu' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

test('login shows Studio in Account while Home retains Collections', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/shorts')
  const nav = page.getByRole('navigation', { name: 'Mobile primary navigation' })
  await nav.getByRole('button', { name: 'Account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Account', exact: true })
  await dialog.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).toHaveURL(/\/shorts$/)
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(session.email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(nav.getByRole('link', { name: 'Browse' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Write' })).toHaveCount(0)
  await nav.getByRole('button', { name: 'Account' }).click()
  await expect(dialog.getByRole('link', { name: /Profile/ })).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Studio', exact: true })).toHaveAttribute('href', '/studio')
  await expect(dialog.getByRole('link', { name: 'Member Hub', exact: true })).toHaveAttribute('href', '/members')
  await expect(dialog.getByRole('link', { name: 'Write', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Sign In' })).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'Sign Up' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/shorts')
  await expect(nav.getByRole('link', { name: 'Write' })).toHaveCount(0)
})

for (const width of [320, 390, 767]) {
  test(`Home Collections and profile Studio navigate at ${width}px`, async ({ page }) => {
    await mockApi(page, true)
    await page.setViewportSize({ width, height: 480 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Mobile primary navigation' })
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Explore', 'Shorts', 'Browse'])
    for (const control of await nav.locator('a, button').all()) {
      const bounds = await control.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    }
    await nav.getByRole('button', { name: 'Account', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Account', exact: true })
    const studio = dialog.getByRole('link', { name: 'Studio', exact: true })
    await expect(studio).toHaveAttribute('href', '/studio')
    await expect(studio).toBeVisible()
    const memberHub = dialog.getByRole('link', { name: 'Member Hub', exact: true })
    await expect(memberHub).toHaveAttribute('href', '/members')
    await expect(memberHub).toBeVisible()
    expect((await studio.boundingBox()).height).toBeGreaterThanOrEqual(44)
    if (width === 390) {
      await dialog.locator('[data-profile-sheet]').screenshot({ path: 'test-results/profile-write-menu.png' })
    }
    await studio.click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(dialog).toHaveCount(0)
    await page.goto('/')
    await nav.getByRole('link', { name: 'Browse', exact: true }).click()
    await expect(page).toHaveURL(/\/collections$/)
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Write', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Browse', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(nav).toBeHidden()
    const desktop = page.getByRole('navigation', { name: 'Desktop primary navigation' })
    await expect(desktop.getByRole('link', { name: 'Studio', exact: true })).toBeVisible()
    await expect(desktop.getByRole('link', { name: 'Collections', exact: true })).toBeVisible()
  })
}

test('sheet exits on desktop resize and stays usable with reduced motion', async ({ page }) => {
  await mockApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 640 })
  await page.goto('/shorts')
  const trigger = page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Account' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Account', exact: true })
  await expect(dialog).toBeVisible()
  await page.setViewportSize({ width: 768, height: 700 })
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeHidden()
  const sidebar = page.getByRole('navigation', { name: 'Desktop primary navigation' })
  await expect(sidebar.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open account menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Studio' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 640 })
  await trigger.click()
  await dialog.getByRole('button', { name: 'Close account menu' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('sheet slides upward to open and downward before backdrop dismissal', async ({ page }) => {
  await mockApi(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/shorts')
  const trigger = page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Account' })
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  const opening = await trigger.evaluate(async button => {
    button.click()
    const positions = []
    const start = performance.now()
    while (performance.now() - start < 450) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const sheet = document.querySelector('[data-profile-sheet]')
      if (sheet) positions.push(sheet.getBoundingClientRect().top)
    }
    return positions
  })
  expect(Math.max(...opening) - opening.at(-1)).toBeGreaterThan(100)
  const dialog = page.getByRole('dialog', { name: 'Account', exact: true })
  const closing = await dialog.evaluate(async element => {
    element.querySelector('[aria-hidden="true"]').click()
    const positions = []
    const start = performance.now()
    while (performance.now() - start < 450) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const sheet = document.querySelector('[data-profile-sheet]')
      if (sheet) positions.push(sheet.getBoundingClientRect().top)
    }
    return positions
  })
  expect(Math.max(...closing) - closing[0]).toBeGreaterThan(100)
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

for (const signedIn of [false, true]) {
  test(`desktop search fills available space for ${signedIn ? 'members' : 'guests'}`, async ({ page }) => {
    await mockApi(page, signedIn)
    await page.goto('/shorts')
    for (const width of [768, 820, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 })
      const nav = page.getByRole('navigation', { name: 'Global navigation' })
      await expect(nav.getByRole('button', { name: /Use .* theme/ })).toHaveCount(0)
      const search = await nav.getByRole('search').boundingBox()
      const action = await nav.getByRole('link', { name: 'Join', exact: true }).boundingBox()
      expect(search.width).toBeLessThanOrEqual(660)
      if (search.width < 660) expect(Math.abs(action.x - (search.x + search.width) - 16)).toBeLessThan(2)
      else expect(search.width).toBe(660)
    }
    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await page.getByLabel('Theme', { exact: true }).click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
}
