import { Link, useLocation } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { useSelector } from 'react-redux'
import { HomeIcon, CollectionIcon, ExploreArrow, ShortsIcon, UserIcon } from '@/shared/icons'
import MobileProfileSheet from '@/features/user/components/MobileProfileSheet'

const NAV = [
  { to: '/',                 label: 'Home',    icon: <HomeIcon /> },
  { to: '/explore/trending', label: 'Explore', icon: <ExploreArrow color="currentColor" /> },
  { to: '/shorts',           label: 'Shorts',  icon: <ShortsIcon /> },
]

export default function BottomBar() {
  const { pathname } = useLocation()
  const isReady = useSelector(state => state.auth.isReady)
  const [profileOpen, setProfileOpen] = useState(false)
  const closeProfile = useCallback(() => setProfileOpen(false), [])
  const browseActive = pathname === '/collections' || pathname.startsWith('/collections/') || pathname === '/series' || pathname.startsWith('/series/') || pathname.startsWith('/shorts/series/')

  return (
    <><nav aria-label="Mobile primary navigation" className="fixed bottom-0 left-0 right-0 h-[calc(4rem_+_env(safe-area-inset-bottom))] bg-[var(--color-bg)] border-t border-[var(--color-border)]
      flex items-center justify-around z-[100] md:hidden pb-[env(safe-area-inset-bottom)]">
      {NAV.map(item => {
        const active = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))
        return (
          <Link key={item.to} to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`button-target flex min-h-10 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 no-underline transition-all duration-150
              text-[10px] font-medium
              ${active || item.to === '/explore/trending' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
          >
            <span className="flex">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
      <Link to="/collections" aria-current={browseActive ? 'page' : undefined} className="button-target flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium text-[var(--color-accent)]"><CollectionIcon /><span>Browse</span></Link>
      <button type="button" disabled={!isReady} aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="mobile-profile-sheet" onClick={() => setProfileOpen(true)} className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium text-[var(--color-accent)]"><UserIcon /><span>Account</span></button>
    </nav>
    {profileOpen && <MobileProfileSheet onClose={closeProfile} />}</>
  )
}
