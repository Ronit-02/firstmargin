/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- The ARIA separator is keyboard and pointer operable as a resize handle. */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useReducedMotion from '@/shared/hooks/useReducedMotion'
import { HomeIcon, PenIcon, ChevronDown, ExploreArrow, CollectionIcon, ShortsIcon, SeriesIcon, MembershipIcon } from '@/shared/icons'
import { useSelector } from 'react-redux'

const HOME_LINK = { to: '/', label: 'Home', icon: <HomeIcon /> }
const BROWSE_LINKS = [
  { to: '/explore/trending', label: 'Trending', icon: <ExploreArrow color="currentColor" /> },
  { to: '/explore/questions', label: 'Questions', icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" /></svg> },
  { to: '/explore/competitions', label: 'Competitions', icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3M12 14v4m-4 2h8" /></svg> },
  { to: '/shorts',           label: 'Shorts', icon: <ShortsIcon /> },
]
const CATALOG_LINKS = [
  { to: '/collections',      label: 'Collections', icon: <CollectionIcon /> },
  { to: '/series',           label: 'Series', icon: <SeriesIcon /> },
]
const SPACE_LINKS = [
  { to: '/studio',           label: 'Studio', icon: <PenIcon /> },
  { to: '/members',          label: 'Member Hub', icon: <MembershipIcon /> },
]

function NavLink({ to, label, icon, active, collapsed = false }) {
  return (
    <Link to={to}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={`flex items-center ${collapsed ? 'gap-0' : 'gap-2.5'} py-2.5 text-[13px] transition-all duration-150 no-underline
        ${collapsed ? 'min-h-11 justify-center px-0' : 'px-5'}
        ${active
          ? 'font-semibold text-(--color-text) bg-(--color-bg-alt) border-l-2 border-(--color-accent)'
          : 'font-normal text-(--color-text-secondary) border-l-2 border-transparent hover:text-(--color-text) hover:bg-(--color-bg-alt)'
        }`}
    >
      {icon && <span className="flex items-center flex-shrink-0 w-4">{icon}</span>}
      <span className={`min-w-0 truncate transition-[max-width,opacity] duration-200 motion-reduce:transition-none ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[220px] flex-1 opacity-100'}`}>{label}</span>
    </Link>
  )
}

function GroupSection({ id, label, items, pathname, reducedMotion, collapsed }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      {collapsed ? <div aria-hidden="true" className="mx-4 my-3 border-t border-(--color-border)" /> :
        <h2><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="button-target flex min-h-11 w-full items-center justify-between px-5 pt-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-(--color-text-muted) hover:text-(--color-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--color-focus)"><span>{label}</span><motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}><ChevronDown /></motion.span></button></h2>}
      <AnimatePresence initial={false}>
        {(collapsed || open) && (
          <motion.div id={id} role="group" aria-label={label} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion || collapsed ? 0 : 0.18 }} style={{ overflow: 'hidden' }}>
            {items.map(item => <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={item.to.startsWith('/explore/') ? pathname.startsWith(item.to) : pathname === item.to} collapsed={collapsed} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const MIN_W = 140, MAX_W = 300, DEF_W = 200
const SIDEBAR_WIDTH_KEY = 'ink-rider.sidebar-width'

function readStoredWidth() {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (raw === null) return DEF_W
    const stored = Number(raw)
    return Number.isFinite(stored) ? Math.min(MAX_W, Math.max(MIN_W, stored)) : DEF_W
  } catch {
    return DEF_W
  }
}

export default function Sidebar({ collapsed, onToggle }) {
  const { pathname } = useLocation()
  const loggedIn = useSelector(state => state.auth.isReady && Boolean(state.auth.user))
  const reducedMotion = useReducedMotion()
  const [width, setWidth] = useState(readStoredWidth)
  const [isResizing, setIsResizing] = useState(false)
  const startX = useRef(0) 
  const startW = useRef(DEF_W)

  const onMouseDown = useCallback(e => {
    startX.current = e.clientX; startW.current = width
    setIsResizing(true)
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'
    
    const onMove = e => setWidth(Math.min(MAX_W, Math.max(MIN_W, startW.current + e.clientX - startX.current)))
    const onUp   = () => { 
      setIsResizing(false)
      document.body.style.userSelect = ''; 
      document.body.style.cursor = ''; 
      window.removeEventListener('mousemove', onMove); 
      window.removeEventListener('mouseup', onUp) 
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width])

  const onResizeKeyDown = useCallback(event => {
    const step = 20;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      setWidth(value => Math.min(MAX_W, Math.max(MIN_W, value + direction * step)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setWidth(MIN_W);
    } else if (event.key === 'End') {
      event.preventDefault();
      setWidth(MAX_W);
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
    } catch {
      // Sidebar resizing remains usable when storage is unavailable.
    }
  }, [width])

  return (
    <aside
      className={`sidebar-desktop shrink-0 h-full overflow-y-auto bg-(--color-bg) border-r border-(--color-border) py-6 relative ${isResizing ? 'transition-none' : 'transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none'}`}
      style={{ width: collapsed ? 64 : width }}
    >
      <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`absolute ${collapsed ? 'right-4' : 'right-3.5'} top-2 z-10 flex h-8 w-8 items-center justify-center rounded-[8px] text-(--color-text-muted) hover:bg-(--color-bg-alt) hover:text-(--color-text-secondary)`}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={collapsed ? 'm7 4 5 5-5 5' : 'm11 4-5 5 5 5'} /></svg>
      </button>
      <nav aria-label="Desktop primary navigation" className="flex min-h-full flex-col pt-4">
        <div>
          <NavLink to={HOME_LINK.to} label={HOME_LINK.label} icon={HOME_LINK.icon} active={pathname === HOME_LINK.to} collapsed={collapsed} />
          <GroupSection id="sidebar-browse-links" label="Browse" items={BROWSE_LINKS} pathname={pathname} reducedMotion={reducedMotion} collapsed={collapsed} />
          <GroupSection id="sidebar-catalog-links" label="Catalog" items={CATALOG_LINKS} pathname={pathname} reducedMotion={reducedMotion} collapsed={collapsed} />
          <GroupSection id="sidebar-space-links" label="Your space" items={SPACE_LINKS.filter(item => item.to !== '/members' || loggedIn)} pathname={pathname} reducedMotion={reducedMotion} collapsed={collapsed} />
        </div>
      </nav>

      {/* Drag handle */}
      {!collapsed && <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        aria-valuenow={width}
        aria-valuetext={`${width}px`}
        tabIndex={0}
        onKeyDown={onResizeKeyDown}
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors hover:bg-(--color-border) focus:bg-(--color-border) focus:outline-none focus:ring-2 focus:ring-(--color-focus) focus:ring-inset"
      />}
    </aside>
  )
}
