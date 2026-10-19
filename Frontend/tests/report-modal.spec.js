import { expectModalHeader } from './helpers/modal-header'
import { test, expect } from '@playwright/test'

const id = '507f1f77bcf86cd799439021'
const answerId = '507f1f77bcf86cd799439022'
const post = { id, _id: id, title: 'Report fixture', excerpt: 'A story.', tags: [], author: { username: 'Writer', handle: 'writer' }, createdAt: '2026-10-08T00:00:00Z', likesCount: 0, commentsCount: 0, body: JSON.stringify([{ id: 'text', type: 'text', content: 'Article body.' }]) }
const entries = [
  ['article', `/post/${id}`, 'Report this post', `/api/post/${id}/reports`],
  ['short detail', `/post/${id}`, 'Report this short', `/api/post/${id}/reports`],
  ['card', '/search?q=report', 'Report this post', `/api/post/${id}/reports`],
  ['short card', '/shorts', 'Report this short', `/api/post/${id}/reports`],
  ['question', `/explore/questions/${id}`, 'Report this question', `/api/question/${id}/reports`],
  ['answer', `/explore/questions/${id}`, 'Report this answer', `/api/question/${id}/answers/${answerId}/reports`],
]

async function mockApi(page, signedIn = true, isShort = false) {
  const reports = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { accessToken: 'report-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } : { message: 'Signed out' } })
    if (path.endsWith('/reports')) {
      reports.push({ path, body: route.request().postDataJSON() })
      return route.fulfill({ status: reports.length === 1 ? 500 : 201, json: reports.length === 1 ? { message: 'Try again.' } : { data: { reported: true }, reported: true } })
    }
    if (path === `/api/post/${id}`) return route.fulfill({ json: { postData: { ...post, format: isShort ? 'short' : 'article' } } })
    if (path === '/api/search') return route.fulfill({ json: { data: { posts: [post], shorts: [post], writers: [] } } })
    if (path === `/api/question/${id}`) return route.fulfill({ json: { data: { id, text: 'Report this question?', tags: [], author: post.author, createdAt: post.createdAt, upvotesCount: 0, followersCount: 0, responsePosts: [], answers: [{ id: answerId, text: 'An answer.', author: post.author, createdAt: post.createdAt, upvotesCount: 0 }] } } })
    return route.fulfill({ json: { data: path === '/api/post/shorts' ? [post] : [], meta: { nextCursor: null }, capabilities: [] } })
  })
  return reports
}

for (const width of [320, 1280]) for (const [kind, path, label, endpoint] of entries) {
  test(`${kind} report is modal and retryable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 600 })
    const reports = await mockApi(page, true, kind === 'short detail')
    await page.goto(path)
    const isCard = kind.includes('card')
    const options = page.getByRole('button', { name: `More options for ${post.title}` })
    const trigger = page.getByRole(isCard ? 'menuitem' : 'button', { name: label, exact: true })
    const open = async () => { if (isCard) await options.click(); await trigger.click() }
    await open()
    const dialog = page.getByRole('dialog', { name: label, exact: true })
    await expect(dialog).toBeVisible()
    await expectModalHeader(dialog)
    expect(await dialog.evaluate(node => node.matches(':modal') && node.parentElement === document.body)).toBe(true)
    if (isCard) await expect(page.getByRole('menu')).toHaveCount(0)
    const box = await dialog.locator('section').first().boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y + box.height).toBeLessThanOrEqual(600)
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.querySelector('section').scrollWidth <= node.querySelector('section').clientWidth)).toBe(true)
    await page.locator('main h1').evaluate(node => { node.tabIndex = -1; node.focus() })
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
    for (let n = 0; n < 10; n++) {
      await page.keyboard.press(n < 5 ? 'Tab' : 'Shift+Tab')
      expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(isCard ? options : trigger).toBeFocused()
    await open()
    await dialog.getByRole('combobox').click()
    await dialog.getByRole('option', { name: 'Harassment', exact: true }).click()
    const details = dialog.getByRole('textbox')
    await expect(details).toBeVisible()
    if (kind !== 'question' && kind !== 'answer') {
      await expect(dialog.getByRole('button', { name: 'Close report dialog' })).toBeVisible()
      await expect(dialog.getByText('Reports are private and help the moderation team review harmful content.')).toBeVisible()
    }
    await details.fill('Preserved context.')
    await dialog.getByRole('button', { name: 'Submit report', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('combobox')).toHaveText('Harassment')
    if (await details.count()) await expect(details).toHaveValue('Preserved context.')
    expect(reports[0]).toEqual({ path: endpoint, body: { reason: 'harassment', details: 'Preserved context.' } })
    await dialog.screenshot({ path: testInfo.outputPath('report.png') })
    await dialog.getByRole('button', { name: 'Submit report', exact: true }).click()
    await expect.poll(() => reports.length).toBe(2)
    {
      await expect(dialog.getByText(kind === 'question' || kind === 'answer' ? /Thanks\./ : 'Report received')).toBeVisible()
      await dialog.getByRole('button', { name: 'Close report dialog' }).click()
      await expect(dialog).toHaveCount(0)
    }
  })
}

for (const [kind, path, label] of entries) test(`guest ${kind} report requires sign-in`, async ({ page }) => {
  const reports = await mockApi(page, false, kind === 'short detail')
  await page.goto(path)
  if (kind.includes('card')) await page.getByRole('button', { name: `More options for ${post.title}` }).click()
  await page.getByRole(kind.includes('card') ? 'menuitem' : 'button', { name: label, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sign in to firstmargin' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('dialog', { name: /^Report this/ })).toHaveCount(0)
  expect(reports).toEqual([])
})
