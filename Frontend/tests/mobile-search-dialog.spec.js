import { test, expect } from '@playwright/test'

const fixture = {
  data: {
    suggestions: [{ text: 'a story about science', articleCount: 1 }],
    posts: [{ id: '507f1f77bcf86cd799439012', title: 'A story about science', author: { username: 'Maya Sen' } }],
    writers: [{ id: '507f1f77bcf86cd799439011', handle: 'maya-sen', displayName: 'Maya Sen' }],
  },
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 325, height: 735 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    if (url.pathname === '/api/search') return route.fulfill({ json: fixture })
    if (url.pathname === '/api/post/feed' && url.searchParams.get('mode') === 'popular') return route.fulfill({ json: { data: [{ id: 'popular-story', title: 'A story about science' }] } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
})

test('mobile search expands into a full-screen modal with topics, live results and focus restoration', async ({ page }) => {
  const trigger = page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox')
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  const input = dialog.getByRole('combobox')
  await expect(dialog).toBeVisible()
  await expect(input).toBeFocused()
  await expect(dialog.getByRole('heading', { name: 'What are you curious about?' })).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Trending searches' }).getByRole('button', { name: 'A story about science' })).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Suggested topics' }).getByRole('listitem')).toHaveCount(6)
  await expect.poll(() => input.evaluate(element => getComputedStyle(element).boxShadow)).toBe('none')
  await expect(input).toHaveAttribute('type', 'text')
  await expect(dialog.getByRole('button', { name: 'Close search' })).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: /View all results/ })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
  const bounds = await dialog.boundingBox()
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 325, height: 735 })
  await expect.poll(async () => (await dialog.getByRole('search').boundingBox()).width).toBeCloseTo(293, 0)
  await expect(page.locator('dialog')).toHaveJSProperty('open', true)
  await dialog.getByRole('button', { name: 'Career', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close search' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  await input.fill('Science')
  await expect(input).toHaveValue('Science')
  await expect(dialog.getByRole('option')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Close search' })).toBeInViewport()
  const typedBounds = await dialog.getByRole('search').boundingBox()
  expect(typedBounds.x + typedBounds.width).toBeLessThanOrEqual(325)
  await input.press('ArrowDown')
  await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  await input.press('ArrowDown')
  await expect(dialog.getByRole('option').last()).toHaveAttribute('aria-selected', 'true')
  await input.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).not.toBeFocused()
  await trigger.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close search' }).click()
  expect(await dialog.count()).toBe(1)
  await expect(dialog).toHaveCount(0)
  await expect(trigger).not.toBeFocused()
  await trigger.click()
  await input.fill('Maya')
  await expect(dialog.getByRole('option')).toHaveCount(2)
  await input.press('ArrowDown')
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/author\/maya-sen$/)
  await expect(dialog).toHaveCount(0)
})

test('mobile search opens focused when the navbar field receives focus directly', async ({ page }) => {
  const trigger = page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox')
  await trigger.focus()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('combobox')).toBeFocused()
})

test('trending searches and suggested topics open results directly', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  const row = dialog.getByRole('list', { name: 'Trending searches' }).getByRole('button', { name: 'A story about science' })
  await expect.poll(() => row.evaluate(element => getComputedStyle(element.parentElement.parentElement).listStyleType)).toBe('none')
  await row.click()
  await expect(page).toHaveURL(/\/search\?q=A%20story%20about%20science$/)
  await expect(dialog).toHaveCount(0)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  await dialog.getByRole('list', { name: 'Suggested topics' }).getByRole('button', { name: 'Science' }).click()
  await expect(page).toHaveURL(/\/search\?q=Science$/)
  await expect(dialog).toHaveCount(0)
})

test('empty and failed suggestions remain recoverable; all results navigation works', async ({ page }) => {
  await page.route('**/api/search?**', route => {
    const query = new URL(route.request().url()).searchParams.get('q')
    return query === 'empty' ? route.fulfill({ json: { data: { posts: [], writers: [] } } }) : route.fulfill({ status: 500, json: { message: 'Unavailable' } })
  })
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  const input = dialog.getByRole('combobox')
  await input.fill('empty')
  await expect(dialog.getByText('No matching searches or authors. Try another phrase.')).toBeVisible()
  await input.fill('failed')
  await expect(dialog.getByText('Suggestions are unavailable.', { exact: false })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\/search\?q=failed$/)
  await expect(dialog).toHaveCount(0)
})

test('reduced motion and desktop resize keep modal search usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  await expect(dialog).toBeVisible()
  await expect.poll(() => dialog.locator('.mobile-search-content').evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  await dialog.getByRole('button', { name: 'Close search' }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  await expect(dialog).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(dialog).toHaveCount(0)
})

test('clear and submit stay adjacent and the search field fits a keyboard-sized viewport', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('combobox').click()
  const dialog = page.getByRole('dialog', { name: 'Search firstmargin' })
  const input = dialog.getByRole('combobox')
  await input.fill('science')
  const clear = dialog.getByRole('button', { name: 'Clear search' })
  const submit = dialog.getByRole('button', { name: 'Search', exact: true })
  await expect.poll(async () => {
    const clearBounds = await clear.boundingBox()
    const submitBounds = await submit.boundingBox()
    return Math.round(submitBounds.x - clearBounds.x - clearBounds.width)
  }).toBe(0)

  await page.setViewportSize({ width: 320, height: 360 })
  await expect(input).toBeFocused()
  await expect.poll(async () => {
    const dialogBounds = await dialog.boundingBox()
    const formBounds = await dialog.getByRole('search').boundingBox()
    return {
      dialogHeight: Math.round(dialogBounds.height),
      formInside: formBounds.x >= dialogBounds.x && formBounds.x + formBounds.width <= dialogBounds.x + dialogBounds.width,
    }
  }).toEqual({ dialogHeight: 360, formInside: true })
  await expect(clear).toBeInViewport()
  await expect(submit).toBeInViewport()
  await expect(dialog.getByRole('option').first()).toBeVisible()
})
