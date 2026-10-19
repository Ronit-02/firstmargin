import { test, expect } from '@playwright/test'

const postId = '507f1f77bcf86cd799439011'

for (const width of [320, 1280]) {
  test(`post deletion confirms, preserves failures, and refreshes lists at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.addInitScript(theme => localStorage.setItem('ink-theme', theme), width === 320 ? 'light' : 'dark')
    let deleted = false
    let attempts = 0
    let release
    const held = new Promise(resolve => { release = resolve })
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'delete-test', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path === '/api/user/me') return route.fulfill({ json: { data: { username: 'Writer', displayName: 'Writer', postCount: deleted ? 0 : 1, joinedAt: '2025-01-01', followersCount: 0, followingCount: 0 } } })
      if (path === '/api/user/me/posts' || path === '/api/user/bookmarks') {
        const posts = deleted ? [] : [{ _id: postId, title: 'Delete this story', format: 'article', publicationStatus: 'unpublished', createdAt: '2025-01-01', likesCount: 2 }]
        return route.fulfill({ json: path.endsWith('/bookmarks') ? posts : { data: posts } })
      }
      if (path === `/api/v1/posts/${postId}` && route.request().method() === 'DELETE') {
        attempts += 1
        if (attempts === 1) return route.fulfill({ status: 500, json: { message: 'Try again' } })
        await held
        deleted = true
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ json: { data: path.includes('/entitlements') ? { capabilities: [] } : [], meta: { unreadCount: 0, nextCursor: null } } })
    })
    await page.goto('/profile?profileTab=posts')
    const opener = page.getByRole('button', { name: 'Manage Delete this story', exact: true })
    await opener.click()
    const trigger = page.getByRole('menuitem', { name: 'Delete story', exact: true })
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Republish', exact: true })).toBeVisible()
    for (const action of [page.getByRole('menuitem', { name: 'Edit', exact: true }), page.getByRole('menuitem', { name: 'Republish', exact: true }), trigger]) {
      const bounds = await action.boundingBox()
      expect(bounds.height).toBeGreaterThanOrEqual(44)
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      await expect(action.locator('svg')).toHaveCount(1)
    }
    await page.screenshot({ path: `node_modules/.cache/writing-list/writing-${width}.png` })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Delete story?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/comments and pending reports/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel delete' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(attempts).toBe(0)
    await opener.click()
    await trigger.click()
    await dialog.getByRole('button', { name: 'Delete story', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be deleted')
    await expect(page.getByRole('link', { name: 'Delete this story', exact: true })).toBeVisible()
    const confirm = dialog.getByRole('button', { name: 'Delete story', exact: true })
    await confirm.click()
    await expect(confirm).toBeDisabled()
    await expect(confirm).toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    expect(attempts).toBe(2)
    release()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Delete this story', exact: true })).toHaveCount(0)
    await page.goto('/saved')
    await expect(page.getByText('Stories you save will appear here.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete story', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
