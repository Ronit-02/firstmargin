import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const stylesheet = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')
const cardGridRules = stylesheet.slice(stylesheet.indexOf('.card-grid {'), stylesheet.indexOf('/* ─── Animation utilities'))

for (const width of [390, 768, 1200]) {
  test(`card grids reserve their columns with one item at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.setContent(`<style>${cardGridRules}</style><main style="width:min(100%,1056px);margin:auto"></main>`)
    for (const variant of ['card-grid--series', 'card-grid--collection', 'card-grid--post', 'card-grid--short', 'competition-entry-grid', 'home-short-grid']) {
      const layout = await page.evaluate(variantName => {
        const container = document.querySelector('main')
        container.className = variantName === 'home-short-grid' ? variantName : `card-grid ${variantName}`
        container.style.gap = '16px'
        container.replaceChildren(document.createElement('article'))
        const oneColumnTracks = getComputedStyle(container).gridTemplateColumns
        const oneItemWidth = container.firstElementChild.getBoundingClientRect().width
        container.append(document.createElement('article'), document.createElement('article'))
        const threeColumnTracks = getComputedStyle(container).gridTemplateColumns
        const threeItemWidth = container.firstElementChild.getBoundingClientRect().width
        return { oneColumnTracks, threeColumnTracks, oneItemWidth, threeItemWidth, containerWidth: container.getBoundingClientRect().width }
      }, variant)
      expect(layout.oneColumnTracks.split(' ').length, variant).toBe(layout.threeColumnTracks.split(' ').length)
      expect(layout.oneItemWidth, variant).toBeCloseTo(layout.threeItemWidth, 1)
      expect(layout.oneItemWidth, variant).toBeLessThanOrEqual(layout.containerWidth)
    }
  })
}

for (const width of [359, 360, 375, 398, 400, 407, 408]) {
  test(`short grids keep the expected columns at ${width}px with both gap sizes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.setContent(`<style>body{margin:0}${cardGridRules}</style><main style="width:calc(100% - 44px);margin:auto"></main>`)
    for (const variant of ['card-grid--short', 'home-short-grid']) {
      for (const gap of [16, 24]) {
        const columns = await page.evaluate(({ name, gapSize }) => {
          const container = document.querySelector('main')
          container.className = name
          container.style.gap = `${gapSize}px`
          return getComputedStyle(container).gridTemplateColumns.split(' ').length
        }, { name: variant, gapSize: gap })
        expect(columns, `${variant} with ${gap}px gap`).toBe(width < 360 ? 1 : 2)
      }
    }
  })
}
