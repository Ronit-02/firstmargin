import { test, expect } from './support/ui-test.js'

const postId = '507f1f77bcf86cd799439012'
const writerId = '507f1f77bcf86cd799439011'
const post = { _id: postId, title: 'A focused idea', body: JSON.stringify([{ id: 'text', type: 'text', content: 'An article for deterministic pending-state coverage.' }]), author: { _id: writerId, username: 'Maya Sen', handle: 'maya-sen' }, tags: [], likesCount: 0, commentsCount: 0, isBookmarked: false, createdAt: '2026-09-08T00:00:00Z' }
const writer = { id: writerId, handle: 'maya-sen', displayName: 'Maya Sen', bio: 'A writer.', posts: [], followersCount: 2, followingCount: 0, joinedAt: '2025-01-15T00:00:00Z', isFollowing: false, isSelf: false }
const competition = { id: 'contest-1', title: 'Writing about place', description: 'A writing competition.', status: 'open', votingMode: 'readers', closeDate: '2026-11-01T00:00:00Z', entries: [{ id: 'entry-1', author: post.author, likesCount: 2, isVoted: false, post }] }
const question = { id: 'question-1', text: 'What makes a focused idea?', context: 'A question for readers.', tags: [], author: post.author, createdAt: post.createdAt, upvotesCount: 2, answersCount: 1, responsePosts: [], answers: [{ id: 'answer-1', text: 'Start with one clear thought.', author: post.author, createdAt: post.createdAt, upvotesCount: 1 }] }
const fixtures = {
  [`/api/post/${postId}`]: { postData: post },
  '/api/writer/maya-sen': { data: writer },
  '/api/competition/contest-1': { data: competition },
  '/api/question': { data: [question], meta: { nextCursor: null } },
  '/api/question/question-1': { data: question },
  '/api/post/shorts': { data: [{ ...post, id: postId, format: 'short' }], meta: { nextCursor: null } },
  '/api/search': { data: { posts: [{ ...post, id: postId }], writers: [], shorts: [], questions: [] } },
  '/api/collection/collection-1': { data: { id: 'collection-1', title: 'Useful ideas', visibility: 'public', author: post.author, posts: [], isSaved: false } },
  '/api/v1/me/entitlements': { data: { capabilities: [], membership: { plan: 'free', status: 'inactive' } } },
  '/api/v1/notifications': { data: [{ _id: 'notice-1', title: 'An update', href: '/', readAt: null, createdAt: '2026-09-08T00:00:00Z' }], meta: { unreadCount: 1 } },
  '/api/collection': { data: [{ id: 'collection-1', title: 'Useful ideas', visibility: 'public', author: post.author, postsCount: 0, isSaved: false }], meta: { nextCursor: null } },
}

async function holdAction(page, path, signedIn = true) {
  let release
  let calls = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === path) {
      calls++
      await new Promise(resolve => { release = resolve })
      return route.fulfill({ status: 500, json: { message: 'Deterministic action failure' } })
    }
    if (pathname === '/api/auth/refresh-token') return signedIn ? route.fulfill({ json: { accessToken: 'pending-test', user: 'Reader', email: 'reader@example.test', role: 'regular' } }) : route.fulfill({ status: 401, json: { message: 'Signed out' } })
    return route.fulfill({ json: fixtures[pathname] || { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return { calls: () => calls, release: () => release() }
}

async function expectMuted(button) {
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
  await expect(button).toHaveCSS('opacity', '1')
  await expect(button).toHaveCSS('cursor', 'wait')
  await expect(button.locator('.animate-spin')).toHaveCount(0)
  if (await button.locator('svg, [data-button-icon]').count()) {
    const icon = button.locator('svg, [data-button-icon]').first()
    await expect.poll(() => icon.evaluate(element => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--color-text-muted)'
      element.appendChild(probe)
      const expected = getComputedStyle(probe).color
      probe.remove()
      const style = getComputedStyle(element)
      return style.color === expected && (element.tagName.toLowerCase() !== 'svg' || style.fill === expected)
    })).toBe(true)
    return
  }
  await expect.poll(() => button.evaluate(element => {
    const probe = document.createElement('span')
    probe.style.background = 'color-mix(in srgb, var(--color-accent) 60%, var(--color-surface))'
    element.appendChild(probe)
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    return getComputedStyle(element).backgroundColor === expected
  })).toBe(true)
}

const actions = [
  { name: 'post appreciation', page: `/post/${postId}`, path: `/api/post/${postId}/like`, button: /Appreciate this story|Remove appreciation/ },
  { name: 'collection bookmark icon', page: '/collections/collection-1', path: '/api/collection/collection-1/save', button: 'Save this collection' },
  { name: 'question feed vote', page: '/explore/questions', path: '/api/question/question-1/upvote', button: /Upvote question|Remove upvote from question/ },
  { name: 'question detail vote', page: '/explore/questions/question-1', path: '/api/question/question-1/upvote', button: /Upvote question|Remove upvote from question/ },
  { name: 'answer vote', page: '/explore/questions/question-1', path: '/api/question/question-1/answers/answer-1/upvote', button: 'Upvote answer' },
  { name: 'writer follow', page: '/author/maya-sen', path: `/api/writer/${writerId}/follow`, button: /^(Follow|Following)$/ },
  { name: 'competition vote', page: '/explore/competitions/contest-1', path: '/api/competition/contest-1/entries/entry-1/vote', button: /Vote for A focused idea/ },
  { name: 'membership checkout', page: '/membership', path: '/api/v1/billing/checkout', button: 'Become a member' },
  { name: 'notification mark-all', page: '/notifications', path: '/api/v1/notifications/read-all', button: 'Mark all read' },
]

for (const { theme, width } of [{ theme: 'light', width: 320 }, { theme: 'dark', width: 1280 }]) {
  for (const action of actions) {
    test(`${action.name} uses muted loading and recovers in ${theme} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
      const held = await holdAction(page, action.path)
      await page.goto(action.page)
      await action.open?.(page)
      const button = page.getByRole(action.role || 'button', { name: action.button, exact: true }).first()
      await expect(button).toBeEnabled()
      await button.click()
      await expectMuted(button)
      if (await button.locator('svg, [data-button-icon]').count()) {
        await page.screenshot({ path: testInfo.outputPath('icon-pending.png') })
        if (await button.getAttribute('data-button-style') === 'action') {
          await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
          if (await button.getAttribute('data-button-boundary') === 'true') {
            const token = await button.evaluate(element => {
              const probe = document.createElement('span')
              probe.style.color = element.getAttribute('aria-pressed') === 'true' ? 'var(--color-accent)' : 'var(--color-border)'
              element.appendChild(probe)
              const color = getComputedStyle(probe).color
              probe.remove()
              return color
            })
            await expect(button).toHaveCSS('border-color', token)
          } else {
            await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)')
          }
        }
      }
      await button.evaluate(element => element.click())
      await expect.poll(held.calls).toBe(1)
      held.release()
      await expect(button).toBeEnabled()
      await expect(button).toHaveAttribute('aria-busy', 'false')
      await button.click()
      await expect.poll(held.calls).toBe(2)
      await expectMuted(button)
      held.release()
      await expect(button).toBeEnabled()
    })
  }
}

test('login preserves its label and dimensions through a delayed failure', async ({ page }) => {
  const held = await holdAction(page, '/api/auth/login', false)
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Example-password-123')
  const button = page.locator('#auth-form button[type="submit"]')
  const before = await button.boundingBox()
  await button.click()
  await expectMuted(button)
  await expect(button).toHaveText('Login')
  const after = await button.boundingBox()
  expect(after.width).toBe(before.width)
  expect(after.height).toBe(before.height)
  await button.evaluate(element => element.click())
  await expect.poll(held.calls).toBe(1)
  held.release()
  await expect(button).toBeEnabled()
})

test('clipboard copy keeps its label while pending and can retry a failure', async ({ page }, testInfo) => {
  await holdAction(page, '/unused-action')
  await page.addInitScript(() => {
    window.copyCalls = 0
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => {
      window.copyCalls++
      return new Promise((resolve, reject) => { window.rejectCopy = () => reject(new Error('Unavailable')) })
    } } })
  })
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: 'Share this story' }).click()
  const copy = page.getByRole('button', { name: 'Copy Link', exact: true })
  await copy.click()
  await expectMuted(copy)
  await expect(copy).toHaveText('Copy Link')
  await page.getByRole('dialog', { name: 'Share story' }).screenshot({ path: testInfo.outputPath('menu-icon-pending.png') })
  await expect(page.getByRole('button', { name: 'Share on X' })).toBeDisabled()
  await copy.evaluate(element => element.click())
  expect(await page.evaluate(() => window.copyCalls)).toBe(1)
  await page.evaluate(() => window.rejectCopy())
  await expect(copy).toBeEnabled()
  await copy.click()
  await expectMuted(copy)
  expect(await page.evaluate(() => window.copyCalls)).toBe(2)
  await page.evaluate(() => window.rejectCopy())
  await expect(copy).toBeEnabled()
})

test('verification and resend use the same fill and prevent overlapping requests', async ({ page }) => {
  let release
  const calls = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/login') return route.fulfill({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email.' } })
    if (path === '/api/auth/resend-otp' || path === '/api/auth/verify-email') {
      calls.push(path)
      await new Promise(resolve => { release = resolve })
      return route.fulfill({ status: 500, json: { message: 'Try again.' } })
    }
    return route.fulfill({ status: 401, json: { message: 'Signed out' } })
  })
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Example-password-123')
  await page.locator('#auth-form button[type="submit"]').click()
  const resend = page.getByRole('button', { name: 'Resend OTP' })
  const verify = page.getByRole('button', { name: 'Verify Email' })
  await resend.click()
  await expectMuted(resend)
  await expect(verify).toBeDisabled()
  await verify.evaluate(element => element.click())
  await expect.poll(() => calls.length).toBe(1)
  release()
  await expect(resend).toBeEnabled()
  for (let index = 1; index <= 6; index++) await page.getByLabel(`Verification digit ${index}`).fill('1')
  await verify.click()
  await expectMuted(verify)
  await expect(resend).toBeDisabled()
  await expect.poll(() => calls.length).toBe(2)
  release()
  await expect(verify).toBeEnabled()
})

test('a query retry is visibly busy while refetching', async ({ page }) => {
  let count = 0
  let release
  await holdAction(page, '/unused-action')
  await page.route(`**/api/post/${postId}`, async route => {
    count++
    if (count <= 2) return route.fulfill({ status: 500, json: { message: 'Unavailable' } })
    await new Promise(resolve => { release = resolve })
    return route.fulfill({ json: { postData: post } })
  })
  await page.goto(`/post/${postId}`)
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await retry.click()
  await expectMuted(retry)
  await retry.evaluate(element => element.click())
  await expect.poll(() => Boolean(release)).toBe(true)
  const pendingCount = count
  release()
  await expect(page.getByRole('heading', { name: post.title, exact: true })).toBeVisible()
  expect(count).toBe(pendingCount)
})

test('native search Retry remains mounted through refetch failure and retry', async ({ page }) => {
  let calls = 0
  let release
  await holdAction(page, '/unused-action')
  await page.route('**/api/search?*', async route => {
    calls++
    if (calls > 1) await new Promise(resolve => { release = resolve })
    return route.fulfill({ status: 500, json: { message: 'Search unavailable' } })
  })
  await page.goto('/search?q=failure')
  const retry = page.getByRole('main').getByRole('button', { name: 'Try again', exact: true })
  await retry.click()
  await expectMuted(retry)
  await expect(page.getByRole('heading', { name: 'Search is unavailable' })).toBeVisible()
  await retry.evaluate(element => element.click())
  await expect.poll(() => calls).toBe(2)
  release()
  await expect(retry).toBeEnabled()
  await retry.click()
  await expectMuted(retry)
  await expect.poll(() => calls).toBe(3)
  release()
  await expect(retry).toBeEnabled()
})

test('collection menu stays visible during save and permits retry after failure', async ({ page }) => {
  const held = await holdAction(page, '/api/collection/collection-1/save')
  await page.goto('/collections')
  await page.getByRole('button', { name: 'More options for Useful ideas' }).click()
  const save = page.getByRole('menuitem', { name: 'Save collection' })
  await save.click()
  await expectMuted(save)
  await save.evaluate(element => element.click())
  await expect.poll(held.calls).toBe(1)
  held.release()
  await expect(save).toBeEnabled()
})

test('sign-out keeps the choice dialog open during the request', async ({ page }) => {
  const held = await holdAction(page, '/api/auth/logout')
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.goto(`/post/${postId}`)
  await page.getByRole('button', { name: 'Open account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign-out options' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign out' })
  const signOut = dialog.getByRole('button', { name: 'Sign out', exact: true })
  await signOut.click()
  await expect(signOut).toBeDisabled()
  await expect(signOut).toHaveAttribute('aria-busy', 'true')
  await expect(dialog.getByRole('button', { name: 'Sign out from all devices' })).toBeDisabled()
  await signOut.evaluate(element => element.click())
  await expect.poll(held.calls).toBe(1)
  held.release()
  await expect(signOut).toBeEnabled()
})

for (const theme of ['light', 'dark']) {
  test(`reusable pill, action, and menu retain their surfaces with icon loading in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    await holdAction(page, '/unused-action')
    await page.goto('/help')
    // Mount the real primitive via Vite to exercise returned-promise loading
    // independently of domain mutations and optimistic cache updates.
    await page.evaluate(async () => {
      const [{ default: React }, { default: ReactDOM }, { default: Button }] = await Promise.all([
        import('/node_modules/.vite/deps/react.js'),
        import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/shared/components/ui/Button.jsx'),
      ])
      const host = document.createElement('section')
      host.setAttribute('aria-label', 'Reusable buttons')
      document.querySelector('main').replaceChildren(host)
      const icon = React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, React.createElement('path', { d: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z' }))
      ReactDOM.createRoot(host).render(React.createElement(React.Fragment, null,
        ...['primary', 'action', 'menu', 'bounded'].map(variant => React.createElement(Button, {
          key: variant, variant: variant === 'bounded' ? 'action' : variant, boundary: variant === 'bounded', leadingIcon: icon,
          onClick: () => new Promise(resolve => { window.releaseButton = resolve }),
        }, `${variant} action`)),
      ))
    })
    for (const variant of ['primary', 'action', 'menu', 'bounded']) {
      const button = page.getByRole('button', { name: `${variant} action`, exact: true })
      await expect(button).toBeVisible()
      await expect(button).not.toHaveAttribute('boundary')
      if (variant === 'bounded') {
        await expect(button).toHaveAttribute('data-button-boundary', 'true')
        const border = await button.evaluate(element => {
          const probe = document.createElement('span')
          probe.style.color = 'var(--color-border)'
          element.appendChild(probe)
          const color = getComputedStyle(probe).color
          probe.remove()
          return color
        })
        await expect(button).toHaveCSS('border-color', border)
      }
      const before = await button.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color, width: element.offsetWidth, height: element.offsetHeight }))
      await button.click()
      await page.mouse.move(0, 0)
      await expectMuted(button)
      await expect(button).toHaveCSS('background-color', before.background)
      await expect(button).toHaveCSS('color', before.color)
      await expect(button).toHaveText(`${variant} action`)
      expect(await button.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }))).toEqual({ width: before.width, height: before.height })
      await page.getByRole('region', { name: 'Reusable buttons' }).screenshot({ path: testInfo.outputPath(`${variant}-pending.png`) })
      await page.evaluate(() => window.releaseButton())
      await expect(button).toBeEnabled()
    }
  })

  test(`mobile sign-out mutes only its icon in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.addInitScript(value => localStorage.setItem('ink-theme', value), theme)
    const held = await holdAction(page, '/api/auth/logout')
    await page.goto(`/post/${postId}`)
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    const signOut = page.getByRole('button', { name: 'Sign Out', exact: true })
    const labelColor = await signOut.evaluate(element => getComputedStyle(element).color)
    await signOut.click()
    await expectMuted(signOut)
    await expect(signOut).toHaveCSS('color', labelColor)
    await expect(signOut).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.getByRole('dialog', { name: 'Account', exact: true }).screenshot({ path: testInfo.outputPath('mobile-menu-pending.png') })
    await signOut.evaluate(element => element.click())
    await expect.poll(held.calls).toBe(1)
    held.release()
    await expect(signOut).toBeEnabled()
  })
}
