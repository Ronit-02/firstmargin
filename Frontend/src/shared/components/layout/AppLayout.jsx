import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { matchPath, Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import BottomBar from './BottomBar'
import ServerUnavailable from './ServerUnavailable'
import BackButton from '@/shared/components/ui/BackButton'
import { useTheme } from '@/shared/hooks/useTheme'
import { useServerUnavailable } from '@/app/serverAvailability'

// Back belongs to detail and drill-down pages, never primary destinations.
const BACK_ROUTES = [
  '/post/:id', '/author/:handle', '/explore/questions/:id',
  '/explore/competitions/:id', '/collections/:id', '/shorts/series/:id', '/series/:id',
  '/staff/competitions/:id/judging',
  '/search', '/membership', '/history', '/profile/edit', '/opportunities',
]

const SCROLL_STORAGE_KEY = 'ink-rider:scroll-positions'
const MAX_SCROLL_ENTRIES = 50

function readScrollPositions() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? new Map(stored) : new Map()
  } catch {
    return new Map()
  }
}

function saveScrollPosition(positions, key, top) {
  positions.delete(key)
  positions.set(key, top)
  while (positions.size > MAX_SCROLL_ENTRIES) positions.delete(positions.keys().next().value)
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify([...positions]))
  } catch {
    // Navigation still works when storage is unavailable.
  }
}

export default function AppLayout({ navigationType }) {
  const location = useLocation()
  const loggedIn = useSelector(state => Boolean(state.auth.user))
  const { dark, toggle: toggleTheme, themePreference, setTheme } = useTheme()
  const isServerUnavailable = useServerUnavailable()
  const scrollPositions = useRef(null)
  const scrollEntry = useRef(null)
  const scrollFloor = useRef(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = window.localStorage.getItem('ink-rider.sidebar-collapsed')
      return stored === null ? window.localStorage.getItem('ink-rider.sidebar-open') === 'false' : stored === 'true'
    } catch { return false }
  })

  const toggleSidebar = () => setSidebarCollapsed(collapsed => !collapsed)

  useEffect(() => {
    try { window.localStorage.setItem('ink-rider.sidebar-collapsed', String(sidebarCollapsed)) } catch { /* Keep the control usable without storage. */ }
  }, [sidebarCollapsed])

  useLayoutEffect(() => {
    const mainContent = document.getElementById('main-content')
    if (!mainContent) return undefined
    const positions = scrollPositions.current ||= readScrollPositions()
    const key = location.key
    const savedTop = positions.get(key)
    const samePage = scrollEntry.current?.pathname === location.pathname
    const targetTop = navigationType === 'POP'
      ? (Number.isFinite(savedTop) ? savedTop : 0)
      : (samePage ? scrollEntry.current.top : 0)
    // Keep the departing offset even if the next filtered list briefly shrinks.
    const entry = { pathname: location.pathname, top: targetTop }
    scrollEntry.current = entry
    saveScrollPosition(positions, key, targetTop)

    const setScrollFloor = top => {
      scrollFloor.current = top > 0 ? top + mainContent.clientHeight : 0
      mainContent.toggleAttribute('data-preserve-scroll', Boolean(scrollFloor.current))
      if (scrollFloor.current) {
        mainContent.style.setProperty('--page-scroll-floor', `${scrollFloor.current}px`)
        mainContent.style.overflowAnchor = 'none'
      } else {
        mainContent.style.removeProperty('--page-scroll-floor')
        mainContent.style.removeProperty('overflow-anchor')
      }
    }
    // A loading/empty list must not clamp the viewport before data arrives.
    // Reserve only the space needed to keep this offset reachable.
    if (samePage) setScrollFloor(targetTop)
    else setScrollFloor(0)

    let restoring = targetTop > 0
    let resizeObserver
    let mutationObserver
    let restoreTimeout
    let observedContent
    const stopRestoring = () => {
      restoring = false
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      clearTimeout(restoreTimeout)
    }
    const restoreScroll = () => {
      if (!restoring) return
      mainContent.scrollTo({ top: targetTop, left: 0, behavior: 'auto' })
      if (mainContent.scrollTop >= targetTop) stopRestoring()
    }
    const observeContent = () => {
      const content = mainContent.lastElementChild
      if (content === observedContent) return
      resizeObserver?.disconnect()
      observedContent = content
      if (content) resizeObserver?.observe(content)
      restoreScroll()
    }

    if (!samePage || navigationType === 'POP') mainContent.focus({ preventScroll: true })
    mainContent.scrollTo({ top: targetTop, left: 0, behavior: 'auto' })
    if (restoring && mainContent.scrollTop < targetTop) {
      resizeObserver = new ResizeObserver(restoreScroll)
      mutationObserver = new MutationObserver(observeContent)
      mutationObserver.observe(mainContent, { childList: true })
      restoreTimeout = setTimeout(stopRestoring, 10000)
      observeContent()
    } else {
      restoring = false
    }

    const saveCurrentScroll = () => {
      entry.top = mainContent.scrollTop
      if (scrollFloor.current && entry.top + mainContent.clientHeight < scrollFloor.current) setScrollFloor(entry.top)
      saveScrollPosition(positions, key, entry.top)
    }
    const handleScroll = () => {
      if (!restoring) saveCurrentScroll()
    }
    const handleUserScroll = () => {
      if (restoring) {
        stopRestoring()
      }
      saveCurrentScroll()
    }
    const handlePageHide = saveCurrentScroll
    mainContent.addEventListener('scroll', handleScroll, { passive: true })
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      mainContent.addEventListener(event, handleUserScroll, { passive: true })
    }
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      stopRestoring()
      mainContent.removeEventListener('scroll', handleScroll)
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
        mainContent.removeEventListener(event, handleUserScroll)
      }
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [location.key, location.pathname, navigationType])

  const handleSkipToContent = event => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  if (isServerUnavailable) return <ServerUnavailable />

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[var(--color-bg)]">
      <a
        href="#main-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[8px] focus:bg-[var(--color-surface)] focus:px-4 focus:py-3 focus:text-[13px] focus:font-semibold focus:text-[var(--color-text)] focus:shadow-[var(--shadow-menu)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
      >
        Skip to content
      </a>
      {/* Fixed-height navbar */}
      <Navbar />

      {/* Content area fills remaining height, both sidebar and main inside */}
      <div className="flex flex-1 overflow-hidden mt-14">

        {/* Sidebar — stays fixed height, doesn't scroll with page */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

        {/* Main — scrolls independently */}
        <div id="main-content" tabIndex={-1} data-app-scroll="true" className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden focus:outline-none max-md:pb-[calc(72px_+_env(safe-area-inset-bottom))]">
          {(location.pathname !== '/history' || loggedIn) && BACK_ROUTES.some(path => matchPath({ path, end: true }, location.pathname)) && <div data-page-back="true" className="app-page-frame pt-4">
            <BackButton className="-ml-2" />
          </div>}
          <Outlet context={{ dark, toggleTheme, themePreference, setTheme }} />
        </div>
      </div>

      {/* Mobile bottom bar */}
      <BottomBar />
    </div>
  )
}
