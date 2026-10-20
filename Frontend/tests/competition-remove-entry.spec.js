import { test, expect } from '@playwright/test'

async function mockCompetition(page, { owner = true, status = 'open', fail = false, delayed = false, role = 'regular' } = {}) {
  let removed = false
  let deletes = 0
  let release
  const wait = delayed ? new Promise(resolve => { release = resolve }) : Promise.resolve()
  const entry = { id: 'entry-1', isOwner: owner, author: { username: 'Maya Sen', handle: 'maya' }, votesCount: 12, isVoted: false, post: { _id: 'story-1', title: 'A story worth sharing', format: 'article', createdAt: '2026-10-01T00:00:00Z', commentsCount: 0 } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'entry-test-token', user: 'Maya Sen', email: 'maya@example.test', role } })
    if (path === '/api/competition/contest-1/entries/entry-1' && request.method() === 'DELETE') {
      deletes++
      await wait
      if (fail) { fail = false; return route.fulfill({ status: 409, json: { message: 'The competition is no longer open' } }) }
      removed = true
      return route.fulfill({ json: { data: { removed: true } } })
    }
    if (path === '/api/competition/contest-1') return route.fulfill({ json: { data: { id: 'contest-1', title: 'Writing about place', status, competitionType: 'reader_choice', closeDate: '2026-11-01T00:00:00Z', entryRestriction: ['moderator', 'admin'].includes(role) ? 'Moderators and admins cannot enter competitions.' : null, isEntered: owner && !removed, entriesCount: removed ? 0 : 1, entries: removed ? [] : [entry] } } })
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return { count: () => deletes, release: () => release?.() }
}

for (const role of ['moderator', 'admin']) {
  test(`${role} cannot open the competition entry form`, async ({ page }) => {
    await mockCompetition(page, { owner: false, role })
    await page.goto('/explore/competitions/contest-1')
    const button = page.getByRole('button', { name: 'Add your entry', exact: true })
    await expect(button).toBeDisabled()
    await button.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Moderators and admins cannot enter competitions.')
    await expect(page.getByRole('dialog', { name: 'Submit a story' })).toHaveCount(0)
  })
}

for (const width of [320, 1280]) {
  test(`owner confirms entry removal and vote loss at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const requests = await mockCompetition(page)
    await page.goto('/explore/competitions/contest-1')
    const selfVote = page.getByRole('button', { name: 'Vote for A story worth sharing', exact: true })
    await expect(selfVote).toBeDisabled()
    await selfVote.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await selfVote.hover()
    await expect(page.getByRole('tooltip')).toHaveText('You cannot vote for your own entry.')
    const trigger = page.getByRole('button', { name: 'Remove entry', exact: true })
    await trigger.click()
    const modal = page.getByRole('dialog', { name: 'Remove your entry?' })
    await expect(modal).toContainText('A story worth sharing')
    await expect(modal).toContainText('You will lose all votes this entry has received.')
    await expect(modal).toContainText('it will start with zero votes')
    await page.screenshot({ path: testInfo.outputPath('remove-entry-confirmation.png') })
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(modal).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(requests.count()).toBe(0)
    await trigger.click()
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    expect(requests.count()).toBe(0)
    await trigger.click()
    await modal.getByRole('button', { name: 'Remove entry', exact: true }).click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add your entry', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Add your entry', exact: true })).toBeFocused()
    expect(requests.count()).toBe(1)
    await page.reload()
    await expect(trigger).toHaveCount(0)
    await expect(page.getByText('0 submitted', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('removal failure keeps the entry and confirmation available for retry', async ({ page }) => {
  const requests = await mockCompetition(page, { fail: true })
  await page.goto('/explore/competitions/contest-1')
  await page.getByRole('button', { name: 'Remove entry', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Remove your entry?' })
  await modal.getByRole('button', { name: 'Remove entry', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('The competition is no longer open')
  await expect(page.getByRole('article')).toHaveCount(1)
  await modal.getByRole('button', { name: 'Remove entry', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(requests.count()).toBe(2)
})

test('pending removal blocks duplicate confirmation and dismissal', async ({ page }) => {
  const requests = await mockCompetition(page, { delayed: true })
  await page.goto('/explore/competitions/contest-1')
  await page.getByRole('button', { name: 'Remove entry', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Remove your entry?' })
  const confirm = modal.getByRole('button', { name: 'Remove entry', exact: true })
  await confirm.click()
  await expect(confirm).toBeDisabled()
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Close remove entry' }).click()
  await expect(modal).toBeVisible()
  expect(requests.count()).toBe(1)
  requests.release()
  await expect(modal).toHaveCount(0)
})

for (const settings of [{ owner: false, status: 'open' }, { owner: true, status: 'judging' }, { owner: true, status: 'closed' }]) {
  test(`removal hidden for owner=${settings.owner} status=${settings.status}`, async ({ page }) => {
    await mockCompetition(page, settings)
    await page.goto('/explore/competitions/contest-1')
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Remove entry', exact: true })).toHaveCount(0)
    if (!settings.owner && settings.status === 'open') await expect(page.getByRole('button', { name: 'Vote for A story worth sharing', exact: true })).toBeEnabled()
  })
}
