import { test, expect } from '@playwright/test'

test('Studio owns creator updates, workshops, and direct requests', async ({ page }) => {
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'studio-test', user: 'Maya', email: 'maya@example.test', role: 'regular' } })
    if (path === '/api/v1/creator-requests/received') return route.fulfill({ json: { data: [{ _id: 'request-1', requesterId: { username: 'Priya' }, subject: 'A reader question', details: 'Could you explain the process?', status: 'pending' }] } })
    if (route.request().method() !== 'GET') {
      writes.push({ method: route.request().method(), path, body: route.request().postDataJSON() })
      return route.fulfill({ status: path === '/api/v1/creator-updates' || path === '/api/v1/workshops' ? 201 : 200, json: { data: { id: 'created' } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })

  await page.goto('/studio?writingTab=updates')
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Add update' }).click()
  const update = page.getByRole('dialog')
  await update.getByRole('textbox', { name: /Title/ }).fill('Process notes')
  await update.getByRole('textbox', { name: /Update/ }).fill('How this story changed.')
  await update.getByRole('button', { name: 'Publish update' }).click()
  await expect.poll(() => writes.some(write => write.path === '/api/v1/creator-updates' && write.body.title === 'Process notes')).toBe(true)

  await page.getByRole('tab', { name: 'Workshops' }).click()
  await page.getByRole('button', { name: 'Create workshop' }).click()
  const workshop = page.getByRole('dialog')
  await workshop.getByRole('textbox', { name: /Title/ }).fill('Making a scene')
  await workshop.getByRole('textbox', { name: /Description/ }).fill('A guided writing session.')
  await workshop.locator('#workshop-starts').fill('2026-11-01T10:00')
  await workshop.locator('#workshop-ends').fill('2026-11-01T11:00')
  await workshop.getByRole('textbox', { name: /Private meeting URL/ }).fill('https://meet.example.test/session')
  await workshop.getByRole('button', { name: 'Publish workshop' }).click()
  await expect.poll(() => writes.some(write => write.path === '/api/v1/workshops' && write.body.title === 'Making a scene')).toBe(true)

  await page.getByRole('tab', { name: 'Requests' }).click()
  await page.getByRole('button', { name: 'Accept' }).click()
  await expect.poll(() => writes.some(write => write.method === 'PATCH' && write.path === '/api/v1/creator-requests/request-1' && write.body.status === 'accepted')).toBe(true)

  await page.goto('/members')
  await expect(page.getByRole('tab', { name: 'Creator studio' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Early access' })).toHaveAttribute('aria-selected', 'true')
})
