import { test, expect } from './support/ui-test.js'

for (const width of [320, 1280]) {
  test(`publishing details and writing controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 })
    let publications = 0
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'test', user: 'Writer', email: 'writer@example.test', role: 'regular' } })
      if (path === '/api/v1/me/entitlements') return route.fulfill({ json: { data: { capabilities: ['early_access'] } } })
      if (path.startsWith('/api/drafts') && ['POST', 'PUT'].includes(request.method())) return route.fulfill({ json: { data: { id: 'publish-modal-draft', version: 1 } } })
      if (path === '/api/post/' && request.method() === 'POST') { publications++; return route.fulfill({ status: 400, json: { message: 'Try publication again.' } }) }
      return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
    })
    await page.goto('/studio?new=article')
    const title = page.getByRole('textbox', { name: 'Story title', exact: true })
    const body = page.getByRole('textbox', { name: 'Paragraph block', exact: true })
    const publish = page.getByRole('button', { name: 'Publish', exact: true })
    await expect(page.getByRole('heading', { name: 'Write Story', exact: true })).toBeVisible()
    await expect(page.getByText('Editing', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => {
      const label = [...document.querySelectorAll('p')].find(element => element.textContent === 'Editing')
      const heading = [...document.querySelectorAll('h1')].find(element => element.textContent === 'Write Story')
      return label.getBoundingClientRect().bottom < heading.getBoundingClientRect().top
    })).toBe(true)
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
    const instructions = page.getByRole('button', { name: 'Instructions', exact: true })
    expect(await instructions.evaluate(button => Number.parseFloat(getComputedStyle(button).borderTopLeftRadius) >= button.getBoundingClientRect().height / 2)).toBe(true)
    await instructions.click()
    const help = page.getByRole('dialog', { name: 'Writing instructions' })
    await expect(help).toBeVisible()
    await expect(help.getByRole('listitem')).toHaveCount(6)
    await expect(help.getByRole('listitem').nth(1)).toContainText('Type / in a block')
    await expect(help.getByRole('listitem').nth(3)).toHaveText('Use Ctrl+Z to undo and Ctrl+Y to redo (Cmd+Z and Cmd+Shift+Z on Mac).')
    await page.keyboard.press('Escape')
    await expect(instructions).toBeFocused()
    await expect(page.getByText('Type / in a block', { exact: false })).toHaveCount(0)
    await expect(title).toBeVisible()
    await expect(publish).toBeDisabled()
    await publish.hover({ force: true })
    await expect(page.getByRole('tooltip')).toContainText('add a title and write your story')
    await expect(page.getByLabel('Add a tag', { exact: true })).toHaveCount(0)
    const positions = await page.evaluate(() => {
      const section = document.querySelector('[aria-label="Writing area"]')
      const title = document.querySelector('#editor-title')
      const body = document.querySelector('[aria-label="Paragraph block"]')
      return [section, title, body].map(element => ({ edge: element.getBoundingClientRect().left, padding: getComputedStyle(element).paddingLeft }))
    })
    expect(positions[1].edge).toBe(positions[2].edge)
    expect(positions[1].padding).toBe('12px')
    expect(positions[2].padding).toBe('12px')
    await title.fill('A published idea')
    await expect(publish).toBeDisabled()
    await body.fill('The story stays on the page while publishing details are chosen.')
    await expect(publish).toBeEnabled()
    await publish.click()
    const dialog = page.getByRole('dialog', { name: 'Publish story' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Before publishing:', { exact: false })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
    await dialog.getByLabel('Add a tag', { exact: true }).fill('writing')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await dialog.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ94AAAAASUVORK5CYII=', 'base64') })
    await expect(dialog.getByLabel('Public release')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(publish).toBeFocused()
    await publish.click()
    await expect(dialog.getByRole('button', { name: 'Remove writing tag' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'Try publication again.' })).toBeVisible()
    expect(publications).toBe(1)
    await expect(title).toHaveValue('A published idea')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('disabled native buttons also explain their reason on hover', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0, nextCursor: null } } })
  })
  await page.goto('/')
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.textContent = 'Unavailable action'
    button.disabled = true
    button.dataset.disabledReason = 'Select a story first.'
    button.style.cssText = 'position:fixed;top:100px;left:100px;z-index:5000;padding:20px'
    document.body.append(button)
  })
  await page.getByRole('button', { name: 'Unavailable action' }).hover({ force: true })
  await expect(page.getByRole('tooltip')).toHaveText('Select a story first.')
})
