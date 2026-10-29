import { test, expect } from './support/ui-test.js'

const id = '507f1f77bcf86cd799439040'
const seriesCover = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="200"%3E%3Crect width="320" height="200" fill="%236b705c"/%3E%3C/svg%3E'
const stories = ['507f1f77bcf86cd799439041', '507f1f77bcf86cd799439042', '507f1f77bcf86cd799439043'].map((postId, index) => ({ id: postId, title: `Story ${index + 1}`, format: 'article', image: index === 0 ? seriesCover : null, isOwner: true, canAddToSeries: true, author: { username: 'Maya Sen', handle: 'maya-sen' } }))
const shorts = ['507f1f77bcf86cd799439045', '507f1f77bcf86cd799439046'].map((postId, index) => ({ id: postId, title: `Short ${index + 1}`, format: 'short', isOwner: true, canAddToSeries: true, author: { username: 'Maya Sen', handle: 'maya-sen' } }))
const shortSeries = { id: '507f1f77bcf86cd799439044', title: 'Short steps', description: 'Two quick reads', type: 'short', entriesCount: 2, author: { username: 'Maya Sen' }, isOwner: true, visibility: 'public', entries: shorts, entriesPreview: shorts.map((entry, index) => ({ id: entry.id, title: entry.title, position: index + 1 })) }
const storySeries = { id, title: 'A longer path', description: 'Read in order', type: 'article', entriesCount: 2, coverImage: seriesCover, createdAt: '2026-10-01T12:00:00.000Z', author: { username: 'Maya Sen' }, isOwner: true, visibility: 'public', entries: stories.slice(0, 2), entriesPreview: stories.slice(0, 2).map((entry, index) => ({ id: entry.id, title: entry.title, position: index + 1 })) }
const looseArticle = { _id: '507f1f77bcf86cd799439047', id: '507f1f77bcf86cd799439047', title: 'A story without a series', format: 'article', isOwner: true, canAddToSeries: true, body: JSON.stringify([{ id: 'body-1', type: 'text', content: 'A published story.' }]), likesCount: 0, commentsCount: 0, author: { _id: '507f1f77bcf86cd799439049', username: 'Maya Sen', handle: 'maya-sen' } }
const looseShort = { ...looseArticle, _id: '507f1f77bcf86cd799439048', id: '507f1f77bcf86cd799439048', title: 'A short without a series', format: 'short' }

async function mockSeries(page, owner = false, listCount = 1) {
  const writes = []
  let eligibleReads = 0
  writes.eligibleReads = () => eligibleReads
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/auth/refresh-token') return route.fulfill(owner ? { json: { accessToken: 'series-fixture', user: 'Maya Sen', email: 'writer@example.test', role: 'writer' } } : { status: 401, json: { message: 'Signed out' } })
    if (path === '/api/series') {
      const item = url.searchParams.get('type') === 'short' ? shortSeries : storySeries
      const postId = url.searchParams.get('postId')
      const containsPost = item.entries?.some(entry => entry.id === postId) || false
      const data = Array.from({ length: listCount }, (_, index) => ({ ...item, isOwner: owner, id: index === 0 ? item.id : `${item.id.slice(0, -1)}${index}`, title: index === 0 ? item.title : `${item.title} ${index + 1}`, coverImage: index % 2 === 0 ? item.coverImage : null, containsPost }))
      return route.fulfill({ json: { data, meta: { nextCursor: null } } })
    }
    if (path === `/api/short-series/${id}`) return route.fulfill({ json: { data: { ...storySeries, isOwner: owner, entries: storySeries.entries.map(entry => ({ ...entry, canAddToSeries: owner })) } } })
    if (path === `/api/short-series/${shortSeries.id}`) return route.fulfill({ json: { data: { ...shortSeries, isOwner: owner, entries: shortSeries.entries.map(entry => ({ ...entry, canAddToSeries: owner })) } } })
    if (path === '/api/short-series/eligible-posts') {
      eligibleReads += 1
      return route.fulfill({ json: { data: url.searchParams.get('type') === 'short' ? shorts : stories } })
    }
    if (path === `/api/post/${looseArticle.id}`) return route.fulfill({ json: { postData: { ...looseArticle, canAddToSeries: owner } } })
    if (path === `/api/post/${looseShort.id}`) return route.fulfill({ json: { postData: looseShort } })
    if (stories.some(story => path === `/api/post/${story.id}`)) {
      const index = stories.findIndex(story => path === `/api/post/${story.id}`)
      return route.fulfill({ json: { postData: { ...looseArticle, ...stories[index], _id: stories[index].id, seriesContext: { id, title: storySeries.title, position: index, total: storySeries.entries.length } } } })
    }
    if (shorts.some(short => path === `/api/post/${short.id}`)) {
      const index = shorts.findIndex(short => path === `/api/post/${short.id}`)
      return route.fulfill({ json: { postData: { ...looseShort, _id: shorts[index].id, id: shorts[index].id, title: shorts[index].title, seriesContext: { id: shortSeries.id, title: shortSeries.title, position: index, total: shorts.length, previous: index > 0 ? { id: shorts[index - 1].id, title: shorts[index - 1].title } : null, next: shorts[index + 1] ? { id: shorts[index + 1].id, title: shorts[index + 1].title } : null } } } })
    }
    if (path.endsWith('/comments')) return route.fulfill({ json: { data: [], meta: { nextCursor: null } } })
    if (path === '/api/v1/events') return route.fulfill({ status: 202, json: { data: null } })
    if (path.match(/^\/api\/series\/[^/]+\/items$/) && route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ json: { data: { added: true, alreadyPresent: false } } })
    }
    if (path === `/api/series/${id}` && route.request().method() === 'PUT') {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ json: { data: { updated: true } } })
    }
    return route.fulfill({ json: { data: [], meta: { nextCursor: null, unreadCount: 0 } } })
  })
  return writes
}

for (const width of [320, 1280]) {
  test(`story series next-part and completion links retain their reading context at ${width}px`, async ({ page }, testInfo) => {
    await mockSeries(page)
    const selectedSeries = { ...storySeries, entries: stories, entriesCount: 3 }
    await page.route(`**/api/short-series/${id}`, route => route.fulfill({ json: { data: selectedSeries } }))
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/series/${id}`)
    await expect(page.getByRole('link', { name: 'Read Story 1', exact: true })).toHaveAttribute('href', `/post/${stories[0].id}?series=${id}`)
    await page.getByRole('link', { name: 'Story 1', exact: true }).click()
    await expect(page).toHaveURL(`/post/${stories[0].id}?series=${id}`)
    const footer = page.getByRole('navigation', { name: 'Story series progression' })
    await expect(footer).toContainText('Up next · Part 2 of 3')
    await expect(footer.getByRole('link', { name: 'Read next part: Story 2' })).toHaveAttribute('href', `/post/${stories[1].id}?series=${id}`)
    await footer.screenshot({ path: testInfo.outputPath(`next-part-${width}.png`) })
    await footer.getByRole('link').click()
    await expect(page.getByRole('heading', { name: 'Story 2', level: 1 })).toBeVisible()
    await expect(footer).toContainText('Up next · Part 3 of 3')
    await page.reload()
    await expect(footer.getByRole('link', { name: 'Read next part: Story 3' })).toHaveAttribute('href', `/post/${stories[2].id}?series=${id}`)
    await footer.getByRole('link').click()
    await expect(page.getByRole('heading', { name: 'Story 3', level: 1 })).toBeVisible()
    await expect(footer).toContainText('This was the last story in this series')
    await expect(footer).toContainText(storySeries.title)
    const explore = footer.getByRole('link', { name: 'Explore more series' })
    await expect(explore).toHaveAttribute('href', '/series')
    await footer.screenshot({ path: testInfo.outputPath(`last-part-${width}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await explore.click()
    await expect(page).toHaveURL('/series')
    await page.goBack()
    await expect(footer).toContainText('This was the last story in this series')
  })
}

test('story opened outside a series keeps its overview link; unrelated or unavailable series cannot supply a next part', async ({ page }) => {
  await mockSeries(page)
  const footer = page.getByRole('navigation', { name: 'Story series progression' })
  await page.goto(`/post/${stories[1].id}`)
  await expect(footer.getByRole('link', { name: `View series: ${storySeries.title}` })).toHaveAttribute('href', `/series/${id}`)
  await expect(footer.getByRole('link', { name: /Read next part|Next post in the series/ })).toHaveCount(0)
  for (const suffix of ['', `?series=${shortSeries.id}`, '?series=invalid']) {
    await page.goto(`/post/${stories[0].id}${suffix}`)
    await expect(footer).toContainText('This story is part of a series · Part 1 of 2')
    await expect(footer.getByRole('link', { name: `View series: ${storySeries.title}` })).toHaveAttribute('href', `/series/${id}`)
    await expect(footer).not.toContainText('Up next')
  }
  await page.route(`**/api/short-series/${id}`, route => route.fulfill({ json: { data: { ...storySeries, entries: stories.slice(1) } } }))
  await page.goto(`/post/${stories[0].id}?series=${id}`)
  await expect(footer.getByRole('link', { name: `View series: ${storySeries.title}` })).toHaveAttribute('href', `/series/${id}`)
  await page.route(`**/api/short-series/${id}`, route => route.fulfill({ status: 404, json: { message: 'Series not found' } }))
  await page.goto(`/post/${stories[0].id}?series=${id}`)
  await expect(footer.getByRole('link', { name: `View series: ${storySeries.title}` })).toHaveAttribute('href', `/series/${id}`)
  await expect(page.locator('[data-reading-body="long-form"]')).toBeVisible()
})

test('story series progression follows the selected series when a story belongs to several', async ({ page }) => {
  await mockSeries(page)
  await page.route(`**/api/short-series/${id}`, route => route.fulfill({ json: { data: { ...storySeries, title: 'A different reading order', entries: [stories[0], stories[2], stories[1]], entriesCount: 3 } } }))
  await page.goto(`/post/${stories[0].id}?series=${id}`)
  await expect(page.getByRole('link', { name: 'Read next part: Story 3' })).toHaveAttribute('href', `/post/${stories[2].id}?series=${id}`)
})

test('series page separates stories and shorts and retains its format after reload', async ({ page }) => {
  await mockSeries(page)
  await page.goto('/series')
  await expect(page.getByRole('heading', { name: 'A longer path' })).toBeVisible()
  await page.getByRole('button', { name: `More options for ${storySeries.title}` }).click()
  await expect(page.getByRole('menuitem', { name: 'Edit series' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Short steps' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Shorts' }).click()
  await expect(page).toHaveURL('/series?type=short')
  await expect(page.getByRole('heading', { name: 'Short steps' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL('/series?type=short')
  await expect(page.getByRole('heading', { name: 'Short steps' })).toBeVisible()
})

test('owner series card menu opens its edit modal', async ({ page }) => {
  await mockSeries(page, true)
  await page.goto('/series')
  await page.getByRole('button', { name: `More options for ${storySeries.title}` }).click()
  const menu = page.getByRole('menu', { name: `Options for ${storySeries.title}` })
  await expect(menu.getByRole('menuitem', { name: 'Delete series' })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Edit series' }).click()
  await expect(page).toHaveURL(`/series/${id}`)
  await expect(page.getByRole('dialog', { name: 'Edit series' })).toBeVisible()
})

test('canceling series image selection keeps edit open', async ({ page }) => {
  await mockSeries(page, true)
  await page.route(`**/api/short-series/${id}`, route => route.fulfill({ json: { data: { ...storySeries, coverImage: null, isOwner: true } } }))
  await page.goto(`/series/${id}`)
  await page.getByRole('button', { name: 'Edit series' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit series' })
  await dialog.locator('input[type="file"]').evaluate(input => {
    input.click = () => {}
  })
  await dialog.getByRole('button', { name: '+ Add image', exact: true }).click()
  await dialog.locator('input[type="file"]').evaluate(input => input.dispatchEvent(new Event('cancel', { bubbles: true })))
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(550)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('short series reader links to its series and scrolls through the ordered list', async ({ page }) => {
  await mockSeries(page)
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto(`/series/${shortSeries.id}`)
  await page.getByRole('link', { name: 'Short 1' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('navigation', { name: 'Series progression' })).toContainText('This short is part of a series · Part 1 of 2')
  await expect(dialog.getByRole('navigation', { name: 'Series progression' }).getByRole('link', { name: 'View series: Short steps' })).toHaveAttribute('href', `/series/${shortSeries.id}`)
  await dialog.locator('[data-series-next-title]').evaluate(node => { node.textContent = 'A long next short title that must remain on one line within the compact navigation strip '.repeat(3) })
  const shortLayout = await dialog.getByRole('navigation', { name: 'Series progression' }).evaluate(nav => {
    const title = nav.querySelector('[data-series-next-title]')
    const action = nav.querySelector('[data-series-next-action]')
    return { titleHeight: title.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(title).lineHeight), clipped: title.scrollWidth > title.clientWidth, titleBottom: title.getBoundingClientRect().bottom, actionTop: action.getBoundingClientRect().top }
  })
  expect(shortLayout.titleHeight).toBeLessThan(shortLayout.lineHeight * 1.5)
  expect(shortLayout.clipped).toBe(true)
  expect(shortLayout.actionTop).toBeGreaterThan(shortLayout.titleBottom)
  const seriesSection = dialog.getByRole('navigation', { name: 'Series progression' })
  const sectionPlacement = await seriesSection.evaluate(nav => ({
    insideReadingPane: Boolean(nav.closest('[data-short-scroll]')),
    afterBody: nav.previousElementSibling?.matches('[data-reading-body="compact"]'),
    outsideFooter: !nav.closest('footer'),
  }))
  expect(sectionPlacement).toEqual({ insideReadingPane: true, afterBody: true, outsideFooter: true })
  await dialog.locator('[data-short-scroll]').evaluate(pane => { pane.scrollTop = pane.scrollHeight })
  await expect(seriesSection).toBeInViewport()
  await page.setViewportSize({ width: 768, height: 760 })
  await dialog.getByRole('button', { name: 'Next short' }).click()
  await expect(dialog.getByRole('heading', { name: 'Short 2' })).toBeVisible()
  await expect(dialog.getByRole('navigation', { name: 'Series progression' }).getByRole('link', { name: 'View series: Short steps' })).toHaveAttribute('href', `/series/${shortSeries.id}`)
  await dialog.getByRole('button', { name: 'Previous short' }).click()
  await expect(dialog.getByRole('heading', { name: 'Short 1' })).toBeVisible()
})

test('shorts opened outside their series link to its overview at either end', async ({ page }) => {
  await mockSeries(page)
  for (const short of shorts) {
    await test.step(short.title, async () => {
      await page.goto(`/post/${short.id}`)
      await expect(page.getByRole('dialog', { name: short.title })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Series progression' }).getByRole('link', { name: 'View series: Short steps' })).toHaveAttribute('href', `/series/${shortSeries.id}`)
    })
  }
})

test('series cards keep responsive grid columns and show ordered chapter previews', async ({ page }) => {
  await mockSeries(page, false, 4)

  for (const viewport of [{ width: 390, height: 844 }, { width: 633, height: 700 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/series')
    const grid = page.locator('.card-grid--series')
    const cards = grid.locator(':scope > article')
    await expect(cards).toHaveCount(4)

    const gridBox = await grid.boundingBox()
    const boxes = await cards.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { x: box.x, width: box.width, height: box.height }
    }))

    await expect(cards.first().getByText('Story series')).toBeVisible()
    await expect(cards.first().getByText('2 parts')).toBeVisible()
    await expect(cards.first().getByText('by Maya Sen')).toBeVisible()
    await expect(cards.first().locator('ol')).toContainText('01Story 1')
    await expect(cards.first().locator('ol')).toContainText('02Story 2')
    await expect(cards.first().locator('img')).toHaveCount(1)
    if (viewport.width >= 800) {
      const widths = await cards.first().evaluate(card => ({
        cover: card.querySelector('.series-card__cover').getBoundingClientRect().width,
        identity: card.querySelector('.series-card__identity').getBoundingClientRect().width,
      }))
      expect(Math.abs(widths.cover - widths.identity)).toBeLessThan(2)
    }
    await expect(cards.nth(1).getByRole('img', { name: 'Story series' })).toBeVisible()
    await expect(cards.nth(1).getByText('IR', { exact: true })).toHaveCount(0)
    if (viewport.width < 800) {
      expect(new Set(boxes.map(box => Math.round(box.x))).size).toBe(1)
      expect(Math.abs(boxes[0].width - gridBox.width)).toBeLessThan(2)
    } else {
      expect(new Set(boxes.map(box => Math.round(box.x))).size).toBe(2)
      expect(boxes[0].width).toBeGreaterThan(420)
    }
  }
})

test('series chapter previews fit complete rows inside a fixed height and update on resize', async ({ page }) => {
  await mockSeries(page)
  const entriesPreview = Array.from({ length: 50 }, (_, index) => ({ id: `part-${index}`, title: `Chapter ${index + 1} with a long title that stays on one line`, position: index + 1 }))
  await page.route(url => url.pathname === '/api/series', route => route.fulfill({ json: {
    data: [2, 4, 50].map(count => ({ ...storySeries, id: `path-${count}`, title: `A path with ${count} parts`, entriesCount: count, entriesPreview: entriesPreview.slice(0, count) })),
    meta: { nextCursor: null },
  } }))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/series')
  const cards = page.locator('.series-card')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(1).locator('li:visible')).toHaveCount(4)
  await expect(cards.nth(1).getByText(/more$/)).toBeHidden()
  let desktopCount
  for (const width of [1280, 390, 320, 633, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const full = cards.last()
    await expect.poll(async () => {
      const visible = await full.locator('li:visible').count()
      return full.getByText(`+ ${50 - visible} more`, { exact: true }).isVisible()
    }).toBe(true)
    const count = await full.locator('li:visible').count()
    if (width === 1280) { expect(count).toBeGreaterThan(3); desktopCount = count }
    if (width === 390) expect(count).toBeLessThan(desktopCount)
    for (const card of await cards.all()) {
      const geometry = await card.evaluate(element => {
        const region = element.querySelector('.series-card__preview').getBoundingClientRect()
        const footer = element.querySelector('.series-card__preview > p')
        const footerVisible = getComputedStyle(footer).visibility === 'visible'
        const rows = [...element.querySelectorAll('li')].filter(row => getComputedStyle(row).visibility === 'visible')
        const last = rows.at(-1)
        const next = last?.nextElementSibling
        const limit = footerVisible ? footer.getBoundingClientRect().top : region.bottom
        return { height: element.getBoundingClientRect().height, lastBottom: last?.getBoundingClientRect().bottom ?? region.top, limit, nextBottom: next?.getBoundingClientRect().bottom ?? null, footerBottom: footerVisible ? footer.getBoundingClientRect().bottom : region.top, regionBottom: region.bottom }
      })
      expect(geometry.height).toBe(330)
      expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.limit + 0.5)
      expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.regionBottom + 0.5)
      if (geometry.nextBottom !== null) expect(geometry.nextBottom).toBeGreaterThan(geometry.limit)
    }
    if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/series-fitting-${width}.png` })
  }
})

test('create series asks for Stories or Shorts before loading eligible writing', async ({ page }) => {
  const requests = await mockSeries(page, true)
  await page.goto('/series')
  await page.getByRole('button', { name: 'Create a series' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a series' })
  await expect(dialog.getByText('What do you want to create a series for?')).toBeVisible()
  expect(requests.eligibleReads()).toBe(0)

  await dialog.getByRole('button', { name: /Shorts Create an ordered series/ }).click()
  const shortDialog = page.getByRole('dialog', { name: 'Create a short series' })
  await expect(shortDialog).toBeVisible()
  await expect(shortDialog.locator('input[type="checkbox"]')).toHaveCount(0)
  const shortPicker = shortDialog.getByRole('combobox', { name: 'Choose published shorts' })
  await shortPicker.click()
  const shortOptions = page.getByRole('listbox', { name: 'Published shorts' })
  await expect(page.getByRole('option', { name: 'Short 1' })).toBeVisible()
  const menuBeforeSelection = await shortOptions.boundingBox()
  await page.getByRole('option', { name: 'Short 1' }).click()
  const menuAfterSelection = await shortOptions.boundingBox()
  expect(Math.abs(menuAfterSelection.y - menuBeforeSelection.y)).toBeLessThan(2)
  await page.getByRole('button', { name: 'Select all' }).click()
  const menuAfterSelectAll = await shortOptions.boundingBox()
  expect(Math.abs(menuAfterSelectAll.y - menuBeforeSelection.y)).toBeLessThan(2)
  await expect(shortPicker).toContainText('2 shorts selected')
  expect(requests.eligibleReads()).toBe(1)

  await page.keyboard.press('Escape')
  await expect(shortDialog.getByRole('list', { name: 'Selected shorts in reading order' })).toContainText('Short 1')
  await expect(shortDialog.getByRole('list', { name: 'Selected shorts in reading order' })).toContainText('Short 2')
  await shortDialog.getByRole('button', { name: 'Back' }).click()
  await expect(dialog.getByRole('button', { name: /Stories Create an ordered series/ })).toBeVisible()
  await dialog.getByRole('button', { name: /Stories Create an ordered series/ }).click()
  const postDialog = page.getByRole('dialog', { name: 'Create a post series' })
  await expect(postDialog).toBeVisible()
  await expect(postDialog.locator('input[type="checkbox"]')).toHaveCount(0)
  await postDialog.getByRole('combobox', { name: 'Choose published posts' }).click()
  await expect(page.getByRole('option', { name: 'Story 1' })).toBeVisible()
  expect(requests.eligibleReads()).toBe(2)
})

test('Library offers a compact series creation action', async ({ page }) => {
  await mockSeries(page, true)
  await page.goto('/saved?libraryTab=series')
  const library = page.getByRole('region', { name: 'My series' })
  await expect(library.getByRole('link', { name: 'Browse series' })).toHaveCount(0)
  const add = library.getByRole('button', { name: 'Add series' })
  await expect(add).toHaveText('+Add')
  await add.click()
  await expect(page).toHaveURL('/saved?libraryTab=series')
  await expect(page.getByRole('dialog', { name: 'Create a series' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await library.getByRole('tab', { name: 'Shorts' }).click()
  await expect(library.getByRole('link', { name: 'Browse series' })).toHaveCount(0)
  await expect(add).toBeVisible()
  await expect(page).toHaveURL('/saved?libraryTab=series&seriesType=short')
})

test('empty Add to series dialog separates browse and create actions', async ({ page }) => {
  await mockSeries(page, true, 0)
  await page.goto(`/post/${looseArticle.id}`)
  await page.getByRole('button', { name: 'Add this story to a series' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to series' })
  await expect(dialog.getByRole('link', { name: 'Browse series' })).toHaveAttribute('href', '/series?type=article')
  await dialog.getByRole('button', { name: 'Create series' }).click()
  await expect(page).toHaveURL(`/post/${looseArticle.id}`)
  await expect(page.getByRole('dialog', { name: 'Create a series' })).toBeVisible()
})

test('series owner can add an existing story and save its reading order', async ({ page }) => {
  const writes = await mockSeries(page, true)
  await page.goto(`/series/${id}`)
  await expect(page.getByRole('heading', { name: 'A longer path' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit series' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit series' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Choose a story to add' }).click()
  await expect(page.getByRole('option', { name: 'Story 1' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Story 2' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Story 3' }).click()
  await expect(page.getByRole('combobox', { name: 'Choose a story to add' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Move Story 3 earlier' }).click()
  await page.getByRole('button', { name: 'Save series' }).click()
  expect(writes).toHaveLength(1)
  expect(writes[0].type).toBe('article')
  expect(writes[0].publicationIds).toEqual([stories[0].id, stories[2].id, stories[1].id])
})

test('owner can update series title and description without changing its order', async ({ page }) => {
  const writes = await mockSeries(page, true)
  await page.goto(`/series/${id}`)
  await page.getByRole('button', { name: 'Edit series' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit series' })
  const title = edit.getByRole('textbox', { name: /Title/ })
  const description = edit.getByRole('textbox', { name: /Description/ })
  await expect(title).toHaveValue(storySeries.title)
  await expect(description).toHaveValue(storySeries.description)
  await expect(edit.getByRole('button', { name: 'Save series' })).toBeDisabled()
  await title.fill(' ')
  await expect(edit.getByRole('button', { name: 'Save series' })).toBeDisabled()
  await title.fill('A revised path')
  await description.fill('New introduction to this series')
  await edit.getByRole('button', { name: 'Save series' }).click()
  await expect(edit).toHaveCount(0)
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ title: 'A revised path', description: 'New introduction to this series', publicationIds: stories.slice(0, 2).map(story => story.id) })
})

test('delete from Edit series opens a separate confirmation dialog', async ({ page }) => {
  await mockSeries(page, true)
  await page.goto(`/series/${id}`)
  await page.getByRole('button', { name: 'Edit series' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit series' })
  await edit.getByRole('button', { name: 'Delete series' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Delete series?' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByText(/Stories in the series are not deleted/)).toBeVisible()
  await confirmation.getByRole('button', { name: 'Close delete series' }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(edit).toBeVisible()
})

test('owner list cards expose Add to series for article and short variants', async ({ page }) => {
  await mockSeries(page, true)
  for (const [seriesId, entry] of [[id, stories[0]], [shortSeries.id, shorts[0]]]) {
    await page.goto(`/series/${seriesId}`)
    await page.getByRole('button', { name: `More options for ${entry.title}` }).click()
    await page.getByRole('menuitem', { name: 'Add to series' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add to series' })
    await dialog.getByRole('combobox').click()
    await dialog.getByRole('option', { name: new RegExp(seriesId === id ? storySeries.title : shortSeries.title) }).click()
    await expect(dialog).toContainText('already in the selected series')
    await expect(dialog.getByRole('button', { name: 'Already in series', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Close add to series' }).click()
  }
})

test('series items stay compact and readable on narrow and wide screens', async ({ page }) => {
  await mockSeries(page, true)
  for (const [seriesId, firstTitle] of [[shortSeries.id, 'Short 1'], [id, 'Story 1']]) {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 760 })
      await page.goto(`/series/${seriesId}`)
      const row = page.locator('ol > li').first()
      await expect(row.getByRole('link', { name: firstTitle, exact: true })).toBeVisible()
      await expect(row.getByRole('button', { name: `More options for ${firstTitle}` })).toBeVisible()
      const bounds = await row.boundingBox()
      expect(bounds.height).toBeLessThan(seriesId === id ? 300 : 180)
      await expect(row.locator('img')).toHaveCount(seriesId === id ? 1 : 0)
      if (seriesId === id) await expect(page.locator('ol > li').nth(1).locator('img')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  }
})

test('article detail action appends to a matching series while shorter omits the series action', async ({ page }) => {
  const writes = await mockSeries(page, true)
  await page.goto(`/post/${looseArticle.id}`)
  await page.getByRole('button', { name: 'Add this story to a series' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to series' })
  await dialog.getByRole('combobox', { name: 'Choose one of your story series' }).click()
  await page.getByRole('option', { name: /A longer path/ }).click()
  await dialog.getByRole('button', { name: 'Add to series', exact: true }).click()

  await page.goto(`/post/${looseShort.id}`)
  await expect(page.getByRole('button', { name: 'Add this short to a series' })).toHaveCount(0)

  expect(writes.filter(write => write.postId)).toEqual([{ postId: looseArticle.id }])
})
