import { test, expect } from './support/ui-test.js'

const shellRoutes = [
  '/',
  '/explore/trending',
  '/search',
  '/collections',
  '/saved',
  '/shorts',
  '/history',
  '/notifications',
  '/profile',
  '/settings',
  '/members',
  '/opportunities',
  '/studio',
  '/onboarding',
  '/login',
  '/signup',
  '/explore/questions',
  '/explore/competitions',
  '/explore/questions/not-an-id',
  '/explore/competitions/not-an-id',
  '/collections/not-an-id',
  '/shorts/series/not-an-id',
  '/post/not-an-id',
  '/author/not-found',
  '/missing-route',
]

// Guarded routes intentionally resolve to the full-screen authentication page
// for anonymous readers, so they do not render the application-shell skip link.
const fullScreenRoutes = new Set([
  '/login',
  '/signup',
  '/onboarding',
  '/saved',
  '/history',
  '/notifications',
  '/profile',
  '/settings',
  '/members',
  '/opportunities',
  '/studio',
  '/staff',
])

for (const route of shellRoutes) {
  test(`core shell remains accessible and overflow-free at 320px: ${route}`, async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async request => {
      const url = new URL(request.request().url())
      if (url.pathname === '/api/auth/refresh-token') {
        return request.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Signed out' }),
        })
      }
      // This audit validates the normal application shell. A 500 preserves
      // route-level recovery states, whereas a refused connection correctly
      // switches the entire app to the separate server-unavailable page.
      return request.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Test server error' }),
      })
    })

    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(route, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('main')).toHaveCount(1)
    if (!fullScreenRoutes.has(route)) {
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached()
      // Route entry intentionally focuses main; start a fresh keyboard traversal.
      await page.locator('body').evaluate(body => { body.tabIndex = -1; body.focus(); body.removeAttribute('tabindex') })
      await page.keyboard.press('Tab')
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#main-content')).toBeFocused()
      expect(await page.locator('main h1').count()).toBeLessThanOrEqual(1)
    }

    const semantics = await page.evaluate(() => {
      const isVisible = element => {
        if (element.matches('[aria-hidden="true"], [hidden]')) return false
        const styles = window.getComputedStyle(element)
        return styles.display !== 'none' && styles.visibility !== 'hidden'
          && element.getBoundingClientRect().width > 0
          && element.getBoundingClientRect().height > 0
      }
      const labelledBy = element => (element.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map(id => document.getElementById(id)?.textContent || '')
        .join(' ')
      const associatedLabel = element => {
        if (!element.id) return ''
        return document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent || ''
      }
      const nameFor = element => [
        element.getAttribute('aria-label'),
        labelledBy(element),
        associatedLabel(element),
        element.getAttribute('placeholder'),
        element.getAttribute('title'),
        element.textContent,
      ].find(value => value?.trim())?.trim() || ''
      const interactiveSelector = [
        'a',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="combobox"]',
        '[role="radio"]',
        '[role="switch"]',
        '[role="tab"]',
      ].join(',')
      const missingNames = [...document.querySelectorAll(interactiveSelector)]
        .filter(isVisible)
        .filter(element => !nameFor(element))
        .map(element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`)
      const idCounts = [...document.querySelectorAll('[id]')].reduce((counts, element) => {
        counts[element.id] = (counts[element.id] || 0) + 1
        return counts
      }, {})
      const duplicateIds = Object.entries(idCounts)
        .filter(([, count]) => count > 1)
        .map(([id]) => id)

      const brokenReferences = [...document.querySelectorAll('[aria-describedby], [aria-labelledby]')]
        .flatMap(element => ['aria-describedby', 'aria-labelledby']
          .flatMap(attribute => (element.getAttribute(attribute) || '')
            .split(/\s+/)
            .filter(Boolean)
            .filter(id => !document.getElementById(id))
            .map(id => `${element.tagName.toLowerCase()}[${attribute}=${id}]`)))

      return { duplicateIds, missingNames, brokenReferences }
    })
    expect(semantics.duplicateIds).toEqual([])
    expect(semantics.missingNames).toEqual([])
    expect(semantics.brokenReferences).toEqual([])

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }))
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  })
}
