import { test, expect } from '@playwright/test'

test('selection toolbar closes when the selection is cleared or focus moves away', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'selection-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const field = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await field.fill('Selected words')
  await field.press('ControlOrMeta+A')
  const toolbar = page.getByRole('toolbar', { name: 'Format selected text' })
  await expect(toolbar).toBeVisible()

  await field.evaluate(element => {
    const range = document.createRange()
    range.setStart(element.firstChild, 8)
    range.collapse(true)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await field.click()
  await expect(toolbar).toHaveCount(0)

  await field.press('ControlOrMeta+A')
  await expect(toolbar).toBeVisible()
  await page.getByRole('heading', { name: 'Write Story' }).click()
  await expect(toolbar).toHaveCount(0)
})

test('bold and italic render in the editor while preserving marker storage', async ({ page }) => {
  let savedBlocks = null
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'selection-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    if (path === '/api/drafts' && route.request().method() === 'POST') {
      savedBlocks = route.request().postDataJSON().blocks
      return route.fulfill({ json: { data: { id: '507f1f77bcf86cd799439041', version: 1 } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const field = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await field.fill('Bold and italic')
  await field.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Bold selected text' }).click()
  await expect(field.locator('strong')).toHaveText('Bold and italic')
  await expect(field).not.toContainText('*')
  await expect.poll(() => savedBlocks?.[0]?.content).toBe('**Bold and italic**')
  await field.press('ControlOrMeta+z')
  await expect(field).toHaveText('Bold and italic')
  await field.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Italicize selected text' }).click()
  await expect(field.locator('em')).toHaveText('Bold and italic')
  await field.press('ControlOrMeta+A')
  await field.press('ControlOrMeta+b')
  await expect(field.locator('strong em')).toHaveText('Bold and italic')
  await field.press('!')
  await expect(field.locator('strong em')).toHaveText('Bold and italic')
  await expect(field).toHaveText('Bold and italic!')
  await field.press('ControlOrMeta+A')
  await field.press('Backspace')
  await expect(field).toBeEmpty()
})

test('phone menu formats the selected text without changing its visible markers', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'selection-token', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
    if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: [] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  await page.goto('/studio?new=article')
  const field = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
  await field.fill('Bold and italic')
  const commands = page.getByRole('toolbar', { name: 'Editor commands' })
  await expect(commands.getByRole('button', { name: 'Bold selected text' })).toBeDisabled()
  await field.evaluate(element => {
    const range = document.createRange()
    range.setStart(element.firstChild, 0)
    range.setEnd(element.firstChild, 4)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await commands.getByRole('button', { name: 'Bold selected text' }).click()
  await expect(field.locator('strong')).toHaveText('Bold')
  await field.evaluate(element => {
    const node = [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.includes('italic'))
    const start = node.textContent.indexOf('italic')
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, start + 6)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })
  await commands.getByRole('button', { name: 'Italicize selected text' }).click()
  await expect(field.locator('em')).toHaveText('italic')
  await expect(field).toHaveText('Bold and italic')
})
