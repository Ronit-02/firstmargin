import { chromium } from '@playwright/test'

const baseUrl = process.env.SEO_CRAWL_URL
const postPath = process.env.SEO_CRAWL_POST_PATH

if (!baseUrl || !postPath) {
  throw new Error('SEO_CRAWL_URL and SEO_CRAWL_POST_PATH are required, for example SEO_CRAWL_URL=https://firstmargin.example SEO_CRAWL_POST_PATH=/post/<published-id>')
}

const base = new URL(baseUrl)
const target = new URL(postPath, base)
if (target.origin !== base.origin || !target.pathname.startsWith('/post/')) {
  throw new Error('SEO_CRAWL_POST_PATH must be a same-origin /post/<published-id> path')
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const response = await page.goto(target.toString(), { waitUntil: 'domcontentloaded' })
  if (!response || response.status() >= 400) throw new Error(`Article route returned HTTP ${response?.status() || 'no response'}`)

  const robotsResponse = await page.request.get(new URL('/robots.txt', base).toString())
  if (!robotsResponse.ok()) throw new Error(`robots.txt returned HTTP ${robotsResponse.status()}`)
  const robots = await robotsResponse.text()
  if (!robots.includes(`Sitemap: ${new URL('/sitemap.xml', base).toString()}`)) throw new Error('robots.txt does not point to the same-origin sitemap.xml')
  const sitemapResponse = await page.request.get(new URL('/sitemap.xml', base).toString())
  if (!sitemapResponse.ok()) throw new Error(`sitemap.xml returned HTTP ${sitemapResponse.status()}`)
  const sitemap = await sitemapResponse.text()
  if (!sitemap.includes('<urlset') || !sitemap.includes(`<loc>${target.toString()}</loc>`)) throw new Error('sitemap.xml does not contain the crawled article URL')

  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })
  const metadata = await page.evaluate(() => {
    const content = selector => document.querySelector(selector)?.getAttribute('content') || ''
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''
    const structuredNodes = [...document.querySelectorAll('script[type="application/ld+json"]')]
    const structured = structuredNodes.map(node => {
      try { return JSON.parse(node.textContent || '') } catch { return null }
    }).find(item => item?.['@type'] === 'Article')
    return {
      title: document.title,
      description: content('meta[name="description"]'),
      ogTitle: content('meta[property="og:title"]'),
      ogDescription: content('meta[property="og:description"]'),
      ogType: content('meta[property="og:type"]'),
      ogUrl: content('meta[property="og:url"]'),
      canonical,
      structured,
    }
  })

  const required = ['title', 'description', 'ogTitle', 'ogDescription', 'ogType', 'ogUrl', 'canonical']
  const missing = required.filter(key => !metadata[key])
  if (missing.length) throw new Error(`Missing SEO metadata: ${missing.join(', ')}`)
  if (metadata.ogType !== 'article') throw new Error(`Expected og:type=article, received ${metadata.ogType}`)
  if (metadata.ogUrl !== target.toString() || metadata.canonical !== target.toString()) {
    throw new Error('Canonical and og:url must match the crawled article URL')
  }
  if (!metadata.structured || metadata.structured.headline !== metadata.ogTitle || metadata.structured.mainEntityOfPage !== target.toString()) {
    throw new Error('Article JSON-LD does not match the crawled article metadata')
  }

  console.log(JSON.stringify({
    route: target.toString(),
    title: metadata.title,
    canonical: metadata.canonical,
    structuredType: metadata.structured['@type'],
  }, null, 2))
} finally {
  await browser.close()
}
