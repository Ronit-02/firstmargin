import { test, expect } from '@playwright/test'

async function mockJudging(page, role, { legacy = false } = {}) {
  const moderatorId = '000000000000000000000001'
  const missingModeratorId = '000000000000000000000002'
  const actorId = role === 'admin' ? '000000000000000000000003' : moderatorId
  const scores = [{ judgeId: moderatorId, submittedBy: moderatorId, moderatorName: 'Ada', submittedByName: 'Ada', craft: 7, originality: 8, relevance: 6, note: 'Original score' }]
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'score-test', user: 'Staff', role } })
    if (path === '/api/user/me') return route.fulfill({ json: { data: { id: actorId, role } } })
    if (path === '/api/competition/test-competition' && request.method() === 'GET') return route.fulfill({ json: { data: { id: 'test-competition', title: 'Autumn stories', status: 'judging', competitionType: legacy ? 'theme' : 'collective_choice', votingMode: 'hybrid', closeDate: '2026-10-01T00:00:00Z', judgeRoster: legacy ? [] : [{ id: moderatorId, username: 'Ada' }, { id: missingModeratorId, username: 'Bea' }], entries: [{ id: 'entry-one', status: 'submitted', votesCount: 2, author: { username: 'Writer' }, publication: { _id: 'story-one', title: 'A story' }, judgeScores: scores }] } } })
    if (path === '/api/competition/test-competition/entries/entry-one/score' && request.method() === 'PUT') {
      const body = request.postDataJSON()
      writes.push(body)
      const existing = scores.find(item => item.judgeId === body.moderatorId)
      if (existing) Object.assign(existing, body)
      else scores.push({ ...body, judgeId: body.moderatorId, submittedBy: actorId, moderatorName: 'Bea', submittedByName: 'Admin' })
      return route.fulfill({ json: { data: { entryId: 'entry-one', score: 8 } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
  })
  return { writes, scores }
}

test('admin edits a recorded moderator score and fills only a missing slot in dialogs', async ({ page }) => {
  const { writes, scores } = await mockJudging(page, 'admin')
  await page.goto('/staff/competitions/test-competition/judging')
  await page.getByRole('button', { name: 'Edit score' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit score for Ada' })
  await expect(edit.getByLabel('Craft')).toHaveValue('7')
  await edit.getByLabel('Craft').fill('9')
  await edit.getByRole('button', { name: 'Save score' }).click()
  await expect(edit).toHaveCount(0)
  await expect.poll(() => writes.length).toBe(1)
  expect(scores).toHaveLength(1)
  expect(writes[0].moderatorId).toBe('000000000000000000000001')

  await page.getByRole('button', { name: 'Add missing score' }).click()
  const add = page.getByRole('dialog', { name: 'Add score for Bea' })
  await add.getByLabel('Craft').fill('8')
  await add.getByLabel('Originality').fill('8')
  await add.getByLabel('Relevance').fill('8')
  await add.getByRole('button', { name: 'Save score' }).click()
  await expect(add).toHaveCount(0)
  expect(writes[1].moderatorId).toBe('000000000000000000000002')
  expect(scores).toHaveLength(2)
})

test('moderator sees no edit or fallback action for submitted scores', async ({ page }) => {
  await mockJudging(page, 'moderator')
  await page.goto('/staff/competitions/test-competition/judging')
  await expect(page.getByText('Submitted by Ada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit score' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add missing score' })).toHaveCount(0)
})

test('legacy admin edits the existing score without adding a separate one', async ({ page }) => {
  await mockJudging(page, 'admin', { legacy: true })
  await page.goto('/staff/competitions/test-competition/judging')
  await expect(page.getByRole('button', { name: 'Edit score' })).toHaveCount(1)
  await expect(page.getByText('Your score')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add score' })).toHaveCount(0)
})
