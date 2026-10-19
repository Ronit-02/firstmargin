import { test, expect } from '@playwright/test'

async function mountControls(page, theme) {
  await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    if (new URL(route.request().url()).pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/help')
  await page.locator('main').waitFor()
  await page.evaluate(async () => {
    // Match the optimized query module used by AIPanel, including Vite's version.
    const source = await (await fetch('/src/features/post/pages/AIPanel.jsx')).text()
    const queryUrl = source.match(/from "([^"]+@tanstack_react-query[^"]+)"/)[1]
    const linkSource = await (await fetch('/src/shared/components/ui/ButtonLink.tsx')).text()
    const routerUrl = linkSource.match(/from "([^"]+react-router-dom[^"]+)"/)[1]
    const [{ default: React }, { default: ReactDOM }, { default: Button }, { default: Pill }, { default: IconButton }, { default: ButtonLink }, interests, tools, query, router] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/shared/components/ui/Button.jsx'), import('/src/shared/components/ui/Pill.jsx'),
      import('/src/shared/components/ui/IconButton.tsx'), import('/src/shared/components/ui/ButtonLink.tsx'),
      import('/src/features/onboarding/pages/StepInterests.jsx'), import('/src/features/post/pages/AIPanel.jsx'),
      import(queryUrl), import(routerUrl),
    ])
    const e = React.createElement
    const host = document.createElement('section')
    host.setAttribute('aria-label', 'Button design verification')
    document.querySelector('main').replaceChildren(host)
    window.auditActivations = 0
    const icon = e('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'currentColor' }, e('circle', { cx: 12, cy: 12, r: 8 }))
    ReactDOM.createRoot(host).render(e(query.QueryClientProvider, { client: new query.QueryClient() }, e(router.MemoryRouter, null,
      ...['sm', 'md', 'lg'].map(size => e('div', { key: size, className: 'flex flex-wrap gap-2 my-2' },
        e(Button, { size }, `${size} primary`),
        e(ButtonLink, { size, to: '/saved' }, `${size} link`),
        e(IconButton, { size, label: `${size} icon`, icon }),
      )),
      ...['secondary', 'ghost', 'action', 'menu', 'disclosure', 'danger'].map(variant => e(Button, { key: variant, variant, 'aria-expanded': variant === 'disclosure' ? false : undefined }, `${variant} sample`)),
      e(Button, { ref: node => { window.auditButtonRef = node }, onClick: () => { window.auditActivations++; return new Promise(resolve => { window.releaseAuditAction = resolve }) } }, 'Pending action'),
      e(ButtonLink, { href: 'https://example.test/reading', variant: 'secondary' }, 'External reading'),
      e(Pill, { label: 'Shared selector', active: true, onClick: () => {} }),
      e(interests.default, { topics: [{ slug: 'audit', displayName: 'Interest chip' }], selected: [], onToggle: () => {} }),
      e(tools.AIStickyButtons, { showSummary: true, readAloud: true, onSummary: () => {}, onAudio: () => {} }),
      e(tools.AccessPanel, { capability: 'article_summary' }),
      e(tools.ReadAloudPanel, { text: 'A shorting sample.' }),
    )))
  })
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
    const bounds = await trigger.boundingBox()
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    expect(bounds.width).toBeGreaterThanOrEqual(44)
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
      for (const name of ['Interest chip', 'Shared selector', 'Article overview', 'Read aloud', 'Become a member', 'Read article aloud']) {
        expect((await page.getByRole('button', { name, exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44)
      }
      for (const name of ['Article overview', 'Read aloud', 'Read article aloud']) {
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
