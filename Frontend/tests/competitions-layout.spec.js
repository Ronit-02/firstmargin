import { test, expect } from '@playwright/test'

const competitions = [
  { id: 'closed-contest', title: 'Small Details, Big Worlds', description: 'A seeded competition exercising entry, voting, judging, and results states. Discover a fresh perspective through careful observation.', status: 'closed', closeDate: '2026-09-13T12:00:00Z', entriesCount: 2, competitionType: 'theme' },
  { id: 'open-contest', title: 'TomorrowAndItsExtraordinarilyLongUnbrokenPossibilities', description: 'Explore tomorrow through a thoughtful piece of writing.', status: 'open', closeDate: '2026-11-13T12:00:00Z', entriesCount: 1234, competitionType: 'timed' },
  { id: 'open-theme', title: 'A theme for careful observation', description: 'Explore a shared theme.', status: 'open', closeDate: '2026-11-13T12:00:00Z', entriesCount: 2, competitionType: 'theme' },
]

for (const width of [320, 390, 600, 640, 1280]) {
  test(`competition cards remain legible and filters work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
      if (pathname === '/api/competition') return route.fulfill({ json: { data: competitions } })
      if (pathname.startsWith('/api/competition/')) return route.fulfill({ json: { data: { ...competitions[0], entries: [] } } })
      return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    })
    await page.goto('/explore/competitions?competitionTab=inactive&keep=reader')
    const title = page.getByRole('heading', { name: competitions[0].title })
    const card = page.getByRole('link').filter({ has: title })
    await expect(title).toBeVisible()
    const layout = await card.evaluate(element => {
      const heading = element.querySelector('h2')
      const description = element.querySelector('p')
      const image = element.firstElementChild
      const status = element.lastElementChild.querySelector('span')
      return {
        card: element.getBoundingClientRect().toJSON(),
        heading: heading.getBoundingClientRect().toJSON(),
        image: image.getBoundingClientRect().toJSON(),
        fontSize: parseFloat(getComputedStyle(description).fontSize),
        statusHeight: status.getBoundingClientRect().height,
        statusLineHeight: parseFloat(getComputedStyle(status).lineHeight),
      }
    })
    expect(layout.statusHeight).toBeLessThanOrEqual(layout.statusLineHeight + 8)
    if (width < 640) {
      expect(layout.image.width).toBeCloseTo(layout.card.width, 0)
      expect(layout.image.height / layout.image.width).toBeCloseTo(9 / 16, 1)
      expect(layout.heading.y).toBeGreaterThan(layout.image.bottom)
      expect(layout.heading.width).toBeCloseTo(layout.card.width, 0)
      expect(layout.fontSize).toBe(14)
    } else {
      expect(layout.image.width).toBe(width >= 1024 ? 220 : 180)
      expect(layout.image.height / layout.image.width).toBeCloseTo(9 / 16, 1)
      expect(layout.heading.x).toBeGreaterThan(layout.image.right)
      expect(layout.fontSize).toBe(12)
    }
    await page.getByRole('button', { name: 'Ongoing', exact: true }).click()
    await expect(page.getByRole('heading', { name: competitions[1].title })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Filter by competition type' })
    await expect(dialog.getByRole('button', { name: 'Reader choice', exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Theme', exact: true }).click()
    await expect(page.getByRole('heading', { name: competitions[2].title })).toBeVisible()
    await dialog.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL('/explore/competitions?keep=reader')
    await dialog.getByRole('button', { name: 'Close filters' }).press('Escape')
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused()
    if (width === 390) {
      await page.evaluate(() => localStorage.setItem('ink-theme', 'dark'))
      await page.reload()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page.getByRole('heading', { name: competitions[1].title })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: 'test-results/competitions-mobile-dark.png', fullPage: true })
    }
  })
}
