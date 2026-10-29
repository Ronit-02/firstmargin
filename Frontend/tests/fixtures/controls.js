import React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as query from '@tanstack/react-query'
import * as router from 'react-router-dom'
import Button from '../../src/shared/components/ui/Button.jsx'
import ButtonLink from '../../src/shared/components/ui/ButtonLink.tsx'
import IconButton from '../../src/shared/components/ui/IconButton.tsx'
import Pill from '../../src/shared/components/ui/Pill.jsx'
import * as interests from '../../src/features/onboarding/pages/StepInterests.jsx'
import * as tools from '../../src/features/post/pages/AIPanel.jsx'

export function mountControls() {
    const e = React.createElement
    const host = document.createElement('section')
    host.setAttribute('aria-label', 'Button design verification')
    document.querySelector('main').replaceChildren(host)
    window.auditActivations = 0
    const icon = e('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'currentColor' }, e('circle', { cx: 12, cy: 12, r: 8 }))
    ReactDOM.createRoot(host).render(e(query.QueryClientProvider, { client: new query.QueryClient() }, e(router.MemoryRouter, null,
      ...['sm', 'md', 'lg'].map(size => e('div', { key: size, className: 'flex flex-wrap gap-2 my-2' },
        e(Button, { size }, `${size} primary`),
        e(ButtonLink, { size, to: '/saved' }, `${size} link`),
        e(IconButton, { size, label: `${size} icon`, icon }),
      )),
      ...['secondary', 'ghost', 'action', 'menu', 'disclosure', 'danger'].map(variant => e(Button, { key: variant, variant, 'aria-expanded': variant === 'disclosure' ? false : undefined }, `${variant} sample`)),
      e(Button, { ref: node => { window.auditButtonRef = node }, onClick: () => { window.auditActivations++; return new Promise(resolve => { window.releaseAuditAction = resolve }) } }, 'Pending action'),
      e(ButtonLink, { href: 'https://example.test/reading', variant: 'secondary' }, 'External reading'),
      e(Pill, { label: 'Shared selector', active: true, onClick: () => {} }),
      e(interests.default, { topics: [{ slug: 'audit', displayName: 'Interest chip' }], selected: [], onToggle: () => {} }),
      e(tools.AIStickyButtons, { showSummary: true, readAloud: true, onSummary: () => {}, onAudio: () => {} }),
      e(tools.ReadAloudPanel, { text: 'A shorting sample.' }),
    )))
}

export function mountAccessPanel() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = ReactDOM.createRoot(host)
  root.render(React.createElement(query.QueryClientProvider, { client: new query.QueryClient() },
    React.createElement(tools.AccessPanel, { capability: 'article_summary', onClose: () => { root.unmount(); host.remove() } })))
}
