import { test, expect } from './support/ui-test.js'

async function mockMembership(page, { signedIn = false, status = 'inactive', role = 'regular', entitlementFailure = false, billingFailure = false, billingStatus = 500, billingCode } = {}) {
  let authenticated = signedIn
  const billingPaths = []
  const entitlementPaths = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(authenticated
      ? { json: { accessToken: 'membership-test', user: 'Reader', email: 'reader@example.test', role } }
      : { status: 401, json: { message: 'Signed out' } })
    if (path === '/api/auth/login') {
      authenticated = true
      return route.fulfill({ json: { token: 'membership-test', username: 'Reader', email: 'reader@example.test', role } })
    }
    if (path === '/api/v1/me/entitlements') {
      entitlementPaths.push(path)
      return route.fulfill(entitlementFailure ? { status: 500, json: { message: 'Failed' } } : { json: { data: { capabilities: [], membership: { plan: status === 'inactive' ? 'free' : 'member', status, currentPeriodEnd: null, cancelAtPeriodEnd: false } } } })
    }
    if (path.startsWith('/api/v1/billing/')) {
      billingPaths.push(path)
      return route.fulfill(billingFailure ? { status: billingStatus, json: { code: billingCode, message: 'Failed' } } : { json: { data: path.endsWith('/portal') ? { portalUrl: '/membership?portal=test' } : { checkoutUrl: '/members?checkout=test' } } })
    }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  return { billingPaths, entitlementPaths }
}

test('Member Hub sections use keyboard-accessible tabs', async ({ page }) => {
  await mockMembership(page, { signedIn: true })
  await page.goto('/members')
  const tabs = page.getByRole('tablist', { name: 'Member hub sections' })
  await expect(tabs.getByRole('tab', { name: 'Early access' })).toHaveAttribute('aria-selected', 'true')
  const extras = tabs.getByRole('tab', { name: 'Creator extras' })
  await extras.click()
  await expect(extras).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/\/members\?memberTab=updates$/)
  await extras.focus()
  await extras.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Workshops' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'Workshops' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Workshops' })).toBeFocused()
  await expect(page).toHaveURL(/\/members\?memberTab=workshops$/)
  await page.reload()
  await expect(tabs.getByRole('tab', { name: 'Workshops' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(tabs.getByRole('tab', { name: 'Creator extras' })).toHaveAttribute('aria-selected', 'true')
  await page.goForward()
  await expect(tabs.getByRole('tab', { name: 'Workshops' })).toHaveAttribute('aria-selected', 'true')
  await tabs.getByRole('tab', { name: 'Workshops' }).press('Home')
  await expect(tabs.getByRole('tab', { name: 'Early access' })).toHaveAttribute('aria-selected', 'true')
})

test('admins retain member access without a billing management action', async ({ page }) => {
  const calls = await mockMembership(page, { signedIn: true, status: 'active', role: 'admin' })
  await page.goto('/shorts')
  await page.getByRole('button', { name: 'Open account menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Manage membership' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Member Hub' })).toHaveCount(0)
  expect(calls.billingPaths).toHaveLength(0)
})

for (const width of [320, 390, 767, 768, 1280]) {
  test(`Join opens the public membership page at ${width}px`, async ({ page }) => {
    const calls = await mockMembership(page)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/shorts')
    const navbarJoin = page.getByRole('navigation', { name: 'Global navigation' }).getByRole('link', { name: 'Join', exact: true })
    if (width < 768) {
      await expect(navbarJoin).toBeHidden()
      await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Account' }).click()
      await page.getByRole('dialog', { name: 'Account', exact: true }).getByRole('link', { name: 'Join', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } else {
      await expect(navbarJoin).toBeVisible()
      await navbarJoin.click()
    }
    await expect(page).toHaveURL(/\/membership$/)
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Go deeper with the writers you love')
    await expect(main.getByRole('heading', { name: 'Your member perks' })).toBeVisible()
    await expect(main.getByRole('heading', { level: 3 })).toHaveCount(7)
    await expect(main.getByRole('heading', { name: 'firstmargin Pro', exact: true })).toBeVisible()
    await expect(main.getByText('₹199 / month', { exact: true })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Sign In to join' })).toBeVisible()
    expect(calls.entitlementPaths).toHaveLength(0)
    expect(calls.billingPaths).toHaveLength(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    if (width === 390) {
      await page.evaluate(() => { localStorage.setItem('ink-theme', 'dark'); document.documentElement.classList.add('dark') })
      await page.screenshot({ path: 'test-results/membership-mobile.png', fullPage: true })
    }
    if (width === 1280) await page.screenshot({ path: 'test-results/membership-desktop.png', fullPage: true })
  })
}

test('guest sign-in returns to membership without automatically starting checkout', async ({ page }) => {
  const calls = await mockMembership(page)
  await page.goto('/membership')
  await page.getByRole('button', { name: 'Sign In to join' }).click()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.test')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL(/\/membership$/)
  const join = page.getByRole('main').getByRole('button', { name: 'Become a member', exact: true })
  await expect(join).toBeEnabled()
  expect(calls.billingPaths).toHaveLength(0)
  await join.click()
  await expect(page).toHaveURL(/\/members\?checkout=test$/)
  expect(calls.billingPaths).toEqual(['/api/v1/billing/checkout'])
})

for (const status of ['active', 'trialing']) {
  test(`${status} membership opens billing management instead of checkout`, async ({ page }) => {
    const calls = await mockMembership(page, { signedIn: true, status })
    await page.goto('/membership')
    await expect(page.getByRole('link', { name: 'Open Member Hub' })).toHaveAttribute('href', '/members')
    await expect(page.getByRole('main').getByRole('button', { name: 'Manage membership' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Manage membership' }).click()
    await expect(page).toHaveURL(/\/membership\?portal=test$/)
    expect(calls.billingPaths).toEqual(['/api/v1/billing/portal'])
  })
}

test('entitlement failure prevents checkout and offers retry', async ({ page }) => {
  const calls = await mockMembership(page, { signedIn: true, entitlementFailure: true })
  await page.goto('/membership')
  await expect(page.getByRole('alert')).toHaveText('Your membership could not be checked.')
  await expect(page.getByRole('button', { name: 'Become a member', exact: true })).toHaveCount(0)
  const count = calls.entitlementPaths.length
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect.poll(() => calls.entitlementPaths.length).toBeGreaterThan(count)
  expect(calls.billingPaths).toHaveLength(0)
})

test('billing failure keeps the join page available', async ({ page }) => {
  const calls = await mockMembership(page, { signedIn: true, billingFailure: true })
  await page.goto('/membership')
  const join = page.getByRole('button', { name: 'Become a member', exact: true })
  await join.click()
  await expect(page.getByRole('alert')).toHaveText('Membership billing could not be opened. Please try again later.')
  await expect(join).toBeEnabled()
  expect(calls.billingPaths).toHaveLength(1)
})

for (const status of ['inactive', 'active']) {
  test(`unconfigured billing preserves the ${status} membership page`, async ({ page }) => {
    const calls = await mockMembership(page, { signedIn: true, status, billingFailure: true, billingStatus: 503, billingCode: 'PROVIDER_NOT_CONFIGURED' })
    await page.goto('/membership')
    if (status === 'active') await page.getByRole('button', { name: 'Open account menu' }).click()
    const action = status === 'active' ? page.getByRole('menuitem', { name: 'Manage membership' }) : page.getByRole('button', { name: 'Become a member', exact: true })
    await action.click()
    await expect(page.getByRole('alert')).toContainText(status === 'active' ? 'Membership management is unavailable.' : 'Paid membership is not available yet.')
    await expect(page.getByRole('navigation', { name: 'Global navigation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your member perks' })).toBeVisible()
    await expect(action).toBeEnabled()
    await expect(page).toHaveURL(/\/membership$/)
    expect(calls.billingPaths).toEqual([`/api/v1/billing/${status === 'active' ? 'portal' : 'checkout'}`])
  })
}

test('a real billing gateway outage retains global recovery', async ({ page }) => {
  await mockMembership(page, { signedIn: true, billingFailure: true, billingStatus: 503 })
  await page.goto('/membership')
  await page.getByRole('button', { name: 'Become a member', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'firstmargin is temporarily unavailable.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Global navigation' })).toHaveCount(0)
})

test('signed-in mobile Profile sheet includes Join', async ({ page }) => {
  await mockMembership(page, { signedIn: true })
  await page.setViewportSize({ width: 390, height: 640 })
  await page.goto('/shorts')
  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Account' }).click()
  await page.getByRole('dialog', { name: 'Account', exact: true }).getByRole('link', { name: 'Join', exact: true }).click()
  await expect(page).toHaveURL(/\/membership$/)
  await expect(page.getByRole('button', { name: 'Become a member', exact: true })).toBeEnabled()
})

for (const status of ['active', 'trialing']) {
  for (const width of [390, 1280]) {
    test(`${status} members manage membership from Account at ${width}px`, async ({ page }) => {
      const calls = await mockMembership(page, { signedIn: true, status })
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/shorts')
      if (width < 768) {
        await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Account' }).click()
        const menu = page.getByRole('dialog', { name: 'Account', exact: true })
        await expect(menu.getByRole('button', { name: 'Manage membership', exact: true })).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Join', exact: true })).toHaveCount(0)
        await menu.getByRole('button', { name: 'Manage membership', exact: true }).click()
      } else {
        const nav = page.getByRole('navigation', { name: 'Global navigation' })
        await expect(nav.getByRole('link', { name: 'Join', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Open account menu' }).click()
        await page.getByRole('menuitem', { name: 'Manage membership' }).click()
      }
      await expect(page).toHaveURL(/\/membership\?portal=test$/)
      expect(calls.billingPaths).toEqual(['/api/v1/billing/portal'])
    })
  }
}
