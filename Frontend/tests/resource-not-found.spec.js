import { expect, test } from '@playwright/test'

const missingId = '507f1f77bcf86cd799439011'

const missingResources = [
  {
    path: `/shorts/series/${missingId}`,
    apiPath: `/api/short-series/${missingId}`,
    title: 'This short series is no longer available',
    recoveryLabel: 'Explore shorts',
    recoveryPath: '/shorts',
  },
  {
    path: `/explore/questions/${missingId}`,
    apiPath: `/api/question/${missingId}`,
    title: 'This question is no longer available',
    recoveryLabel: 'Explore questions',
    recoveryPath: '/explore/questions',
  },
  {
    path: `/explore/competitions/${missingId}`,
    apiPath: `/api/competition/${missingId}`,
    title: 'This competition is no longer available',
    recoveryLabel: 'Explore competitions',
    recoveryPath: '/explore/competitions',
  },
]

for (const resource of missingResources) {
  test(`${resource.title} provides a discovery recovery link`, async ({ page }) => {
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const requestUrl = new URL(route.request().url())
      if (requestUrl.pathname === '/api/auth/refresh-token') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Signed out' }) })
      if (requestUrl.pathname === resource.apiPath) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) })
      return route.abort('blockedbyclient')
    })

    await page.goto(resource.path, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: resource.title })).toBeVisible()
    await expect(page.getByRole('link', { name: resource.recoveryLabel })).toHaveAttribute('href', resource.recoveryPath)
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  })
}
