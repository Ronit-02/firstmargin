import { test, expect } from './support/ui-test.js'

async function mountControls(page, theme) {
  await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    if (new URL(route.request().url()).pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/help')
  await page.locator('main').waitFor()
  await page.evaluate(async () => { const fixture = await import('/tests/fixtures/controls.js'); fixture.mountControls() })
  await page.getByRole('button', { name: 'md primary', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

for (const theme of ['light', 'dark']) {
  test(`navbar notification target and badge follow theme colors in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'button-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 3 } } })
    })
    await page.goto('/help')
    const trigger = page.getByRole('link', { name: '3 unread notifications' })
    await expect(trigger).toBeVisible()
    const hitTarget = await trigger.evaluate(node => {
      const bounds = node.getBoundingClientRect()
      const hit = getComputedStyle(node, '::before')
      return { height: bounds.height - parseFloat(hit.top) - parseFloat(hit.bottom), width: bounds.width - parseFloat(hit.left) - parseFloat(hit.right) }
    })
    expect(hitTarget.height).toBeGreaterThanOrEqual(44)
    expect(hitTarget.width).toBeGreaterThanOrEqual(44)
    const colors = await trigger.getByText('3', { exact: true }).evaluate(node => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--color-text-inverted)'
      node.append(probe)
      const expected = getComputedStyle(probe).color
      probe.remove()
      return { expected, actual: getComputedStyle(node).color }
    })
    expect(colors.actual).toBe(colors.expected)
    expect((await page.getByRole('link', { name: 'Join', exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(36)
  })
  for (const width of [320, 1280]) {
    test(`shared sizes, links and article contrast at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 })
      await mountControls(page, theme)
      for (const size of ['sm', 'md', 'lg']) {
        const height = size === 'lg' ? 48 : 44
        const primary = page.getByRole('button', { name: `${size} primary`, exact: true })
        const link = page.getByRole('link', { name: `${size} link`, exact: true })
        const icon = page.getByRole('button', { name: `${size} icon`, exact: true })
        for (const control of [primary, link, icon]) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(height)
        expect((await icon.boundingBox()).width).toBeGreaterThanOrEqual(height)
        await expect(primary).not.toHaveAttribute('size')
        await expect(link).toHaveAttribute('href', '/saved')
        const appearance = async locator => locator.evaluate(node => { const s = getComputedStyle(node); return [s.color, s.backgroundColor, s.fontSize, s.paddingLeft] })
        expect(await appearance(link)).toEqual(await appearance(primary))
      }
      for (const name of ['Interest chip', 'Shared selector', 'Story overview', 'Read aloud', 'Read story aloud']) {
        expect((await page.getByRole('button', { name, exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44)
      }
      for (const name of ['Story overview', 'Read aloud', 'Read story aloud']) {
        const control = page.getByRole('button', { name, exact: true })
        const colors = await control.evaluate(node => {
          const probe = document.createElement('span')
          probe.style.color = 'var(--color-text-inverted)'
          node.append(probe)
          const expected = getComputedStyle(probe).color
          probe.remove()
          const icon = node.querySelector('svg')
          return { expected, actual: getComputedStyle(icon)[icon.getAttribute('fill') === 'none' ? 'stroke' : 'fill'] }
        })
        expect(colors.actual).toBe(colors.expected)
      }
      await expect(page.getByRole('link', { name: 'External reading' })).toHaveAttribute('href', 'https://example.test/reading')
      await page.evaluate(async () => { const fixture = await import('/tests/fixtures/controls.js'); fixture.mountAccessPanel() })
      const membership = page.getByRole('dialog', { name: 'Member feature', exact: true })
      await expect(membership).toBeVisible()
      expect((await membership.getByRole('button', { name: 'Become a member' }).boundingBox()).height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: `node_modules/.cache/button-design-fix/${width}-${theme}.png`, fullPage: true })
    })
  }
  test(`shared ref, pending protection and disclosure shape in ${theme}`, async ({ page }) => {
    await mountControls(page, theme)
    const button = page.getByRole('button', { name: 'Pending action', exact: true })
    const initial = await button.boundingBox()
    expect(await button.evaluate(node => window.auditButtonRef === node)).toBe(true)
    await button.click()
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await button.evaluate(node => node.click())
    expect(await page.evaluate(() => window.auditActivations)).toBe(1)
    expect(await button.boundingBox()).toEqual(initial)
    await page.evaluate(() => window.releaseAuditAction())
    await expect(button).toBeEnabled()
    await expect(button).toHaveAttribute('aria-busy', 'false')
    const disclosure = page.getByRole('button', { name: 'disclosure sample' })
    expect(await disclosure.evaluate(node => getComputedStyle(node).borderRadius)).toBe('0px')
    await expect(disclosure.locator('[data-disclosure-chevron]')).toBeVisible()
  })
}
