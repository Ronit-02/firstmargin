import { test, expect } from './support/ui-test.js'

test('ask-community dialog submits through a required semantic form', async ({ page }) => {
  let submittedQuestion
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/refresh-token') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'question-test-token', user: 'Priya Mehta', email: 'member@inkrider.local', role: 'regular' }),
      })
    }
    if (url.pathname === '/api/v1/notifications') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }) })
    }
    if (url.pathname === '/api/question/suggest') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    }
    if (url.pathname === '/api/v1/tags') {
      const choices = [{ value: 'science', label: 'Science' }, { value: 'technology', label: 'Technology' }]
      return route.fulfill({ json: { data: choices.filter(choice => choice.value.includes(url.searchParams.get('q') || '')) } })
    }
    if (url.pathname === '/api/search' && url.searchParams.get('type') === 'writers') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { writers: [{ id: '507f1f77bcf86cd799439041', displayName: 'Maya Sen', handle: 'maya-sen' }], posts: [], shorts: [] } }) })
    }
    if (url.pathname === '/api/question' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { nextCursor: null } }) })
    }
    if (url.pathname === '/api/question' && request.method() === 'POST') {
      submittedQuestion = request.postDataJSON()
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: '507f1f77bcf86cd799439040', mergedExisting: false } }) })
    }
    return route.fulfill({ status: 404, json: { message: 'No fixture for this endpoint' } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore/questions', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ask a question' }).click()

  const dialog = page.getByRole('dialog', { name: 'Ask the community' })
  const close = dialog.getByRole('button', { name: 'Close' })
  const closeBounds = await close.boundingBox()
  expect(closeBounds?.width).toBeGreaterThanOrEqual(40)
  expect(closeBounds?.height).toBeGreaterThanOrEqual(40)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ask a question' })).toBeFocused()
  await page.getByRole('button', { name: 'Ask a question' }).click()
  const reopenedDialog = page.getByRole('dialog', { name: 'Ask the community' })
  await expect(reopenedDialog).toBeVisible()
  const question = dialog.getByLabel('Question')
  const submit = dialog.getByRole('button', { name: 'Post question' })
  await expect(question).toHaveAttribute('required', '')
  await expect(question).toHaveAttribute('minlength', '10')
  await expect(submit).toHaveAttribute('type', 'submit')
  await expect(submit).toBeDisabled()

  const tagInput = dialog.getByRole('combobox', { name: 'Add a tag' })
  await expect(tagInput).toHaveAttribute('maxlength', '30')
  await tagInput.focus()
  await dialog.getByRole('option', { name: 'Science' }).click()
  await expect(dialog.getByRole('button', { name: 'Remove science tag' })).toBeVisible()
  await tagInput.fill('neighborhood memory')
  await dialog.getByRole('option', { name: 'Add new tag “neighborhood memory”' }).click()
  await expect(dialog.getByLabel('Selected tags')).toContainText('neighborhood memory')
  await dialog.getByRole('button', { name: 'Remove science tag' }).click()
  await expect(dialog.getByRole('button', { name: 'Remove science tag' })).toHaveCount(0)

  const targetWriters = dialog.getByLabel('Target writers')
  await targetWriters.fill('maya')
  await expect(dialog.getByRole('button', { name: /Maya Sen.*maya-sen/ })).toBeVisible()
  await dialog.getByRole('button', { name: /Maya Sen.*maya-sen/ }).click()
  await expect(dialog.getByRole('button', { name: /Maya Sen ×/ })).toBeVisible()

  await question.fill('How can cities preserve neighborhood memory?')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(dialog.getByRole('heading', { name: 'Your question is now open to writers.' })).toBeVisible()
  expect(submittedQuestion.tags).toEqual(['neighborhood memory'])
  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ))
  expect(hasHorizontalOverflow).toBe(false)
})
