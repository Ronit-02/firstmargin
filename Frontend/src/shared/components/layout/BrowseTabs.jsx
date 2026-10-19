import { Link, useLocation } from 'react-router-dom'

const sections = [
  { to: '/collections', label: 'Collections' },
  { to: '/series', label: 'Series' },
]

export default function BrowseTabs() {
  const { pathname } = useLocation()

  return <nav aria-label="Browse sections" className="sticky top-0 z-20 mb-8 bg-[var(--color-bg)] md:hidden">
    <div className="flex gap-2 border-b border-[var(--color-border)]">
      {sections.map(section => {
        const current = pathname === section.to || pathname.startsWith(`${section.to}/`)
        return <Link key={section.to} to={section.to} aria-current={current ? 'page' : undefined}
          className={`button-target inline-flex min-h-11 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 ${current ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
          {section.label}
        </Link>
      })}
    </div>
  </nav>
}
