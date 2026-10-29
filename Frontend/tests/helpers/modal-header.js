import { expect } from '@playwright/test'

export async function expectModalHeader(dialog) {
  const header = dialog.locator('[data-modal-header]').first()
  await expect(header).toBeVisible()
  const heading = header.getByRole('heading', { level: 2 })
  await expect(heading).toBeVisible()
  const style = await header.evaluate(element => {
    const title = getComputedStyle(element.querySelector('h2'))
    const close = element.querySelector('button')
    const button = getComputedStyle(close)
    const rect = close.getBoundingClientRect()
    const heading = element.querySelector('h2').getBoundingClientRect()
    return { font: title.fontFamily, size: title.fontSize, weight: title.fontWeight, divider: getComputedStyle(element).borderBottomWidth, border: button.borderTopWidth, width: rect.width, height: rect.height, overflow: element.scrollWidth > element.clientWidth, hasSubtitle: Boolean(element.querySelector('p')), centerDifference: Math.abs(heading.y + heading.height / 2 - rect.y - rect.height / 2) }
  })
  expect(style.font).toContain('Libre Baskerville')
  expect(style.size).toBe('20px')
  expect(style.weight).toBe('700')
  const phoneAccount = await dialog.evaluate(element => element.id === 'mobile-profile-sheet' && innerWidth < 768)
  expect(style.divider).toBe(phoneAccount ? '0px' : '1px')
  expect(style.border).toBe('0px')
  expect(style.width).toBe(44)
  expect(style.height).toBe(44)
  expect(style.overflow).toBe(false)
  if (!style.hasSubtitle) expect(style.centerDifference).toBeLessThanOrEqual(1)
}
