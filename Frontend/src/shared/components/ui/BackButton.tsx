import { useLocation, useNavigate } from 'react-router-dom'

type BackButtonProps = {
  fallbackTo?: string
  onBack?: () => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

function parentPath(pathname: string) {
  if (pathname.startsWith('/staff/competitions/')) return '/staff'
  if (pathname.startsWith('/explore/questions/')) return '/explore/questions'
  if (pathname.startsWith('/explore/competitions/')) return '/explore/competitions'
  if (pathname.startsWith('/collections/')) return '/collections'
  if (pathname.startsWith('/shorts/series/')) return '/shorts'
  if (pathname.startsWith('/series/')) return '/series'
  if (['/settings', '/history', '/profile/edit', '/opportunities'].includes(pathname)) return '/profile'
  return '/'
}

export default function BackButton({ fallbackTo, onBack, disabled = false, className = '', ariaLabel }: BackButtonProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const handleBack = () => {
    if (onBack) return onBack()
    // BrowserRouter's index excludes an external page or a fresh direct entry.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(fallbackTo || parentPath(location.pathname), { replace: true })
  }

  return <button type="button" onClick={handleBack} disabled={disabled} aria-label={ariaLabel}
    className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[8px] border-0 bg-transparent px-2 py-2 text-[13px] font-medium leading-5 text-[var(--color-text-secondary)] outline-none transition-colors hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6-6 6 6 6M4 12h16" /></svg>
    <span>Back</span>
  </button>
}
