import { test, expect } from './support/ui-test.js'

const posts = Array.from({ length: 14 }, (_, index) => ({
  id: `507f1f77bcf86cd7994390${20 + index}`,
  title: `Filter story ${index + 1}`,
  excerpt: 'A story for filter navigation checks.',
  format: index === 13 ? 'short' : 'article',
  body: '[]',
  tags: [index % 2 ? 'travel' : 'science'],
  author: { id: 'writer-id', username: 'Writer', handle: 'writer' },
  createdAt: index % 2 ? '2020-01-01' : new Date().toISOString(),
  likesCount: index,
  readTime: '3 min read',
}))

async function mockApi(page) {
  const reads = []
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    reads.push({ path: url.pathname, ...Object.fromEntries(url.searchParams) })
    const reply = json => route.fulfill({ json })
    if (url.pathname === '/api/auth/refresh-token') return reply({ accessToken: 'filter-history-test', user: 'Writer', role: 'admin' })
    if (url.pathname === '/api/user/me') return reply({ data: { id: 'staff-id', role: 'admin', displayName: 'Writer', username: 'Writer', handle: 'writer', joinedAt: '2020-01-01', posts: [] } })
    if (url.pathname === '/api/v1/me/entitlements') return reply({ data: { capabilities: [], membership: { plan: 'free', status: 'inactive' } } })
    if (url.pathname === '/api/search') {
      const items = url.searchParams.get('topic') === 'science' ? posts.filter(post => post.tags.includes('science')) : posts
      return reply({ data: { posts: items, shorts: [], questions: [], writers: [] } })
    }
    if (url.pathname === '/api/post/feed') return reply({ data: posts, meta: { nextCursor: null } })
    if (url.pathname === '/api/post/shorts') return reply({ data: posts.map(post => ({ ...post, format: 'short' })), meta: { nextCursor: null } })
    if (url.pathname === '/api/question') return reply({ data: posts.map(post => ({ ...post, text: post.title, responsePosts: [], upvotesCount: post.likesCount, answersCount: 0 })), meta: { nextCursor: null } })
    if (url.pathname === '/api/collection/mixed') return reply({ data: { id: 'mixed', title: 'Mixed collection', description: '', author: { username: 'Writer' }, posts, postsCount: posts.length, savedCount: 0, followersCount: 0, visibility: 'public', isOwner: false } })
    if (url.pathname === '/api/staff/reports') return reply({ data: [{ _id: 'report', subjectType: 'post', reason: 'spam', details: `Reports: ${url.searchParams.get('status')}`, status: 'pending', createdAt: '2026-01-01' }] })
    if (url.pathname === '/api/staff/users') {
      const pageNumber = Number(url.searchParams.get('page'))
      return reply({ data: [{ id: 'account-id', username: `User ${url.searchParams.get('role')} page ${pageNumber}`, email: 'reader@example.test', role: 'regular', accountStatus: 'active' }], meta: { page: pageNumber, pageSize: 25, total: 30, hasMore: pageNumber === 1 } })
    }
    if (url.pathname === '/api/competition') return reply({ data: [{ id: 'contest', title: 'Past competition', status: 'closed', closeDate: '2020-01-01', competitionType: 'reader_choice' }] })
    if (url.pathname === '/api/v1/workshops/mine') return reply({ data: [{ _id: 'past', title: 'Past workshop', status: 'published', startsAt: '2020-01-01', endsAt: '2020-01-02', capacity: 10 }] })
    return reply({ data: [], meta: { nextCursor: null, unreadCount: 0 } })
  })
  return reads
}

async function selectFilter(page, label) {
  await page.getByRole('button', { name: /^Filters/ }).click()
  const dialog = page.getByRole('dialog', { name: /^Filter by/ })
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await dialog.getByRole('button', { name: 'Close filters' }).click()
}

for (const width of [390, 1280]) {
  test(`Home category changes keep scroll and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.addInitScript(() => { delete window.IntersectionObserver })
    await mockApi(page)
    await page.goto('/?keep=yes')
    const main = page.locator('#main-content')
    const categories = page.getByRole('region', { name: 'Browse categories', exact: true })
    const science = categories.getByRole('button', { name: 'science', exact: true })
    await science.scrollIntoViewIfNeeded()
    const initialTop = await main.evaluate(element => element.scrollTop)
    expect(initialTop).toBeGreaterThan(100)
    await science.click()
    await expect(page).toHaveURL('/?keep=yes&homeCategory=science')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(initialTop)
    await expect(science).toBeFocused()
    await science.press('Enter')
    await expect(page).toHaveURL('/?keep=yes')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(initialTop)
    await expect(science).toBeFocused()

    // Each filter history entry owns its subsequently scrolled position.
    await main.evaluate(element => { element.scrollTop -= 80 })
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(initialTop - 80)
    await page.goBack()
    await expect(page).toHaveURL('/?keep=yes&homeCategory=science')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(initialTop)
    await page.goForward()
    await expect(page).toHaveURL('/?keep=yes')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(initialTop - 80)
    await page.getByRole('link', { name: 'firstmargin home', exact: true }).click()
    await page.getByRole('link', { name: /^View trending/ }).click()
    await expect(page).toHaveURL('/explore/trending')
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
  })

  test(`Search filter changes and reset restore through reload and history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const reads = await mockApi(page)
    await page.goto('/search?q=filter&keep=yes#results')
    await page.getByRole('button', { name: /^Filters/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Refine results' })
    await dialog.getByRole('button', { name: 'Science', exact: true }).click()
    await expect(page).toHaveURL(/topic=science#results$/)
    await dialog.getByRole('combobox', { name: 'Sort' }).click()
    await dialog.getByRole('option', { name: 'Latest', exact: true }).click()
    const filteredUrl = page.url()
    await dialog.getByRole('button', { name: 'Close filters' }).click()
    await page.reload()
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(dialog.getByRole('button', { name: 'Science', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('combobox', { name: 'Sort' })).toHaveText('Latest')
    expect(reads.some(read => read.path === '/api/search' && read.topic === 'science' && read.sort === 'latest')).toBe(true)
    await dialog.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL('/search?q=filter&keep=yes#results')
    await dialog.getByRole('button', { name: 'Close filters' }).click()
    await page.goBack()
    await expect(page).toHaveURL(filteredUrl)
    await page.goBack()
    await expect(page).toHaveURL('/search?q=filter&keep=yes&topic=science#results')
    await page.goForward()
    await expect(page).toHaveURL(filteredUrl)
    await page.goForward()
    await expect(page).toHaveURL('/search?q=filter&keep=yes#results')
  })

  test(`staff status, role, and page survive reload, tab remount, and history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const reads = await mockApi(page)
    await page.goto('/staff?keep=yes#reports')
    await selectFilter(page, 'Pending')
    const reportUrl = page.url()
    await page.reload()
    await expect(page.getByText('Reports: pending', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Competitions', exact: true }).click()
    await selectFilter(page, 'Past')
    const contestUrl = page.url()
    await page.reload()
    await expect(page.getByRole('link', { name: 'View Past competition competition' })).toBeVisible()
    await page.getByRole('tab', { name: 'Users', exact: true }).click()
    await selectFilter(page, 'Members')
    await expect(page.getByText('User premium page 1', { exact: true })).toBeVisible()
    const roleUrl = page.url()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    const pageUrl = page.url()
    await page.reload()
    await expect(page.getByText('User premium page 2', { exact: true })).toBeVisible()
    await selectFilter(page, 'Regular')
    await expect(page.getByText('User regular page 1', { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(pageUrl)
    await expect(page.getByText('User premium page 2', { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(roleUrl)
    await page.goForward()
    await expect(page).toHaveURL(pageUrl)
    await page.getByRole('tab', { name: 'Moderation', exact: true }).click()
    await expect(page.getByText('Reports: pending', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Users', exact: true }).click()
    await expect(page.getByText('User premium page 2', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Competitions', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('staffCompetitionStatus=past'))
    expect(new URL(page.url()).hash).toBe('#reports')
    expect(reads.some(read => read.path === '/api/competition' && read.status === 'closed')).toBe(true)
    expect(reportUrl).toContain('reportStatus=pending')
    expect(contestUrl).toContain('keep=yes')
  })

  test(`collection format and Studio workshop status restore at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockApi(page)
    await page.goto('/collections/mixed?keep=yes#stories')
    const formats = page.getByRole('group', { name: 'Collection format' })
    await formats.getByRole('button', { name: 'Shorts', exact: true }).click()
    const shortsUrl = page.url()
    await page.reload()
    await expect(formats.getByRole('button', { name: 'Shorts', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: 'Filter story 14', exact: true })).toBeVisible()
    await formats.getByRole('button', { name: 'Stories', exact: true }).click()
    await expect(page).toHaveURL('/collections/mixed?keep=yes#stories')
    await page.goBack()
    await expect(page).toHaveURL(shortsUrl)
    await expect(formats.getByRole('button', { name: 'Shorts', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.goForward()
    await expect(formats.getByRole('button', { name: 'Stories', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/studio?writingTab=workshops&keep=yes#workshops')
    const statuses = page.getByRole('group', { name: 'Workshop status' })
    await statuses.getByRole('button', { name: 'Inactive', exact: true }).click()
    const workshopUrl = page.url()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Past workshop' })).toBeVisible()
    await statuses.getByRole('button', { name: 'Active', exact: true }).click()
    await expect(page.getByText('No active workshops.', { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(workshopUrl)
    await expect(statuses.getByRole('button', { name: 'Inactive', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.goForward()
    await expect(statuses.getByRole('button', { name: 'Active', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
}

test('Home category toggles restore after refresh and Back/Forward', async ({ page }) => {
  await page.addInitScript(() => { delete window.IntersectionObserver })
  await mockApi(page)
  await page.goto('/?keep=yes#categories')
  const categories = page.getByRole('region', { name: 'Browse categories', exact: true })
  const science = categories.getByRole('button', { name: 'science', exact: true })
  await science.click()
  const selectedUrl = page.url()
  await page.reload()
  await expect(science).toHaveAttribute('aria-pressed', 'true')
  await science.click()
  await expect(page).toHaveURL('/?keep=yes#categories')
  await page.goBack()
  await expect(page).toHaveURL(selectedUrl)
  await expect(science).toHaveAttribute('aria-pressed', 'true')
  await page.goForward()
  await expect(science).toHaveAttribute('aria-pressed', 'false')
})

test('invalid filter values fall back to the existing defaults', async ({ page }) => {
  const reads = await mockApi(page)
  await page.goto('/staff?staffTab=users&staffRole=unknown&staffPage=-2')
  await expect(page.getByText('User all page 1', { exact: true })).toBeVisible()
  await page.goto('/staff?reportStatus=unknown&staffCompetitionStatus=unknown')
  await expect(page.getByText('Reports: all', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Competitions', exact: true }).click()
  await expect(page.getByRole('link', { name: 'View Past competition competition' })).toBeVisible()
  expect(reads.some(read => read.path === '/api/competition' && read.status === 'closed')).toBe(false)
  await page.goto('/collections/mixed?collectionFormat=unknown')
  await expect(page.getByRole('group', { name: 'Collection format' }).getByRole('button', { name: 'Stories', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/studio?writingTab=workshops&workshopStatus=unknown')
  await expect(page.getByRole('group', { name: 'Workshop status' }).getByRole('button', { name: 'Active', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

for (const surface of [
  { path: '/explore/trending', key: 'trendingSort', label: 'Latest', defaultLabel: 'Most appreciated' },
  { path: '/explore/questions', key: 'questionSort', label: 'Newest', defaultLabel: 'Most upvoted' },
  { path: '/shorts', key: 'shortSort', label: 'Most appreciated', defaultLabel: 'Latest' },
]) {
  test(`${surface.path} existing filters restore through reload and browser navigation`, async ({ page }) => {
    await mockApi(page)
    await page.goto(`${surface.path}?keep=yes`)
    await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByRole('combobox', { name: 'Sort', exact: true }).click()
    await page.getByRole('option', { name: surface.label, exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.has(surface.key)).toBe(true)
    const selectedUrl = page.url()
    await page.reload()
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText(surface.label)
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL(`${surface.path}?keep=yes`)
    await page.reload()
    await page.goBack()
    await expect(page).toHaveURL(selectedUrl)
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText(surface.label)
    await page.getByRole('button', { name: 'Close filters' }).click()
    await page.goForward()
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText(surface.defaultLabel)
  })
}
