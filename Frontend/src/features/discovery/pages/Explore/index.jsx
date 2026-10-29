/* ExplorePage — wraps sub-tabs with an in-page selector on mobile */
import { Link, Outlet, useLocation } from 'react-router-dom'
import PageFrame from '@/shared/components/layout/PageFrame'

const exploreSections = [
  { path: '/explore/trending', label: 'Trending' },
  { path: '/explore/questions', label: 'Questions' },
  { path: '/explore/competitions', label: 'Competitions' },
]

export default function ExplorePage() {
  const { pathname } = useLocation()

  return (
    <PageFrame>
      <nav aria-label="Explore sections" className="sticky top-0 z-20 mb-8 bg-[var(--color-bg)]">
        <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-[var(--color-border)]">
          {exploreSections.map(section => {
            const isCurrent = pathname === section.path
            return <Link
              key={section.path}
              to={section.path}
              aria-current={isCurrent ? 'page' : undefined}
              className={`button-target inline-flex min-h-11 shrink-0 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0 ${isCurrent
                ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >{section.label}</Link>
          })}
        </div>
      </nav>
      <Outlet />
    </PageFrame>
  )
}
