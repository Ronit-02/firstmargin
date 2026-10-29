import { test as base, expect } from '@playwright/test'

// Page-owned API fixtures take precedence. Any request they do not handle is
// blocked here and reported, never sent to a developer's application backend.
export const test = base.extend({
  isolatedApi: [async ({ context }, use) => {
    const unexpected = []
    await context.route(url => url.pathname.startsWith('/api/'), route => {
      unexpected.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
      return route.abort('blockedbyclient')
    })
    await use()
    expect(unexpected, 'UI tests must explicitly mock every API request').toEqual([])
  }, { auto: true }],
})

export { expect }

export async function setCheckbox(checkbox, checked = true) {
  await expect(checkbox).toBeEnabled()
  if (await checkbox.isChecked() !== checked) {
    await checkbox.focus()
    await checkbox.press('Space')
  }
  if (checked) await expect(checkbox).toBeChecked()
  else await expect(checkbox).not.toBeChecked()
}
