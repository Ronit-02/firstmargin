import ViewportPopover from '@/shared/components/ui/ViewportPopover'
/* eslint-disable react-hooks/set-state-in-effect -- URL navigation and changing suggestions intentionally synchronize transient search state. */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import useAuth from '@/features/auth/hooks/useAuth'
import Button from '@/shared/components/ui/Button'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import Avatar from '@/shared/components/ui/Avatar'
import { BookmarkIcon, LogoIcon, MembershipIcon, SearchIcon, SettingsIcon, UserIcon } from '@/shared/icons'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useQuery } from '@tanstack/react-query'
import { fetchNotifications } from '@/features/notification/api/notifications'
import { searchDiscovery } from '@/features/discovery/api/search'
import { fetchDiscoveryFeed } from '@/features/discovery/api/feed'
import { getTrendingSearches, suggestedSearchTopics } from '@/features/discovery/searchPrompts'
import MobileSearchDialog from '@/features/discovery/components/MobileSearchDialog'
import roleLabel from '@/features/user/utils/roleLabel'
import useEntitlements from '@/features/membership/hooks/useEntitlements'
import useManageMembership from '@/features/membership/hooks/useManageMembership'

function SignOutDialog({ onClose, returnFocusRef, onSignOut, onSignOutAll, pending }) {
  const titleId = useId()
  const dismiss = () => { if (!pending) onClose() }
  const panelRef = useDialogFocus(dismiss)
  return <ModalLayer aria-labelledby={titleId} onDismiss={dismiss} returnFocusRef={returnFocusRef} className="flex items-center justify-center p-4">
    <section ref={panelRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
      <ModalHeader title="Sign out" titleId={titleId} onClose={dismiss} closeLabel="Close sign-out options" />
      <div className="space-y-4 p-4 sm:p-6">
        <p className="text-[13px] leading-5 text-[var(--color-text-secondary)]">Choose where to end your session.</p>
        <div className="flex flex-col gap-3">
          <Button onClick={onSignOut} disabled={pending} aria-busy={pending}>Sign out</Button>
          <Button variant="secondary" onClick={onSignOutAll} disabled={pending} aria-busy={pending}>Sign out from all devices</Button>
        </div>
      </div>
    </section>
  </ModalLayer>
}


export default function Navbar() {
  const { user, avatarUrl, signOut, signOutAllDevices, isSigningOut, loggedIn } = useAuth()
  const role = useSelector(state => state.auth.role)
  const isReady = useSelector(state => state.auth.isReady)
  const entitlements = useEntitlements(isReady && loggedIn)
  const isMember = ['active', 'trialing'].includes(entitlements.data?.membership?.status)
  const canManageMembership = isMember && role !== 'admin'
  const manageMembership = useManageMembership()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOrigin, setMobileSearchOrigin] = useState(null)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(), enabled: loggedIn, staleTime: 30000, refetchInterval: 60000, retry: false })
  const menuRef = useRef()
  const accountButtonRef = useRef()
  const accountMenuRef = useRef()
  const suggestionsRef = useRef()
  const searchRef = useRef()
  const searchInputRef = useRef()
  const closingMobileSearchRef = useRef(false)
  const closeMobileSearch = useCallback(() => {
    closingMobileSearchRef.current = true
    setMobileSearchOrigin(null)
    setSearchOpen(false)
    requestAnimationFrame(() => {
      searchInputRef.current?.blur()
      closingMobileSearchRef.current = false
    })
  }, [])
  const searchSuggestions = useQuery({
    queryKey: ['search-suggestions', 'content-v1', suggestionQuery],
    queryFn: () => searchDiscovery({ query: suggestionQuery, type: 'all', suggestions: true, limit: 5 }),
    enabled: searchOpen && suggestionQuery.length >= 1 && suggestionQuery === searchValue.trim(),
    staleTime: 30_000,
    retry: false,
  })
  const popularSearches = useQuery({
    queryKey: ['search-popular-stories'],
    queryFn: () => fetchDiscoveryFeed({ mode: 'popular', sort: 'popular', cursor: null }),
    enabled: searchOpen && !searchValue.trim() && !mobileSearchOrigin,
    staleTime: 60_000,
    retry: false,
  })
  useEffect(() => {
    const timer = window.setTimeout(() => setSuggestionQuery(searchValue.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchValue])

  useClickOutside(menuRef, () => setOpenMenu(false), accountMenuRef)
  useClickOutside(searchRef, () => { setSearchOpen(false); setActiveSuggestionIndex(-1) }, suggestionsRef)
  useEscapeKey(() => {
    if (openMenu) accountButtonRef.current?.focus()
    setOpenMenu(false)
    setSearchOpen(false)
    setActiveSuggestionIndex(-1)
  })
  useEffect(() => {
    setSearchValue(new URLSearchParams(location.search).get('q') || '')
  }, [location.pathname, location.search])
  useEffect(() => {
    if (!loggedIn) setSignOutOpen(false)
  }, [loggedIn])
  useEffect(() => {
    if (!openMenu) return undefined
    const frame = requestAnimationFrame(() => accountMenuRef.current?.querySelector('[role="menuitem"][href]')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [openMenu])

  const runSearch = event => {
    event?.preventDefault()
    const activeSuggestion = suggestionItems[activeSuggestionIndex]
    if (activeSuggestion) {
      openSuggestion(activeSuggestion.kind, activeSuggestion.item)
      return
    }
    const query = searchValue.trim()
    if (query.length >= 1) {
      setSearchOpen(false)
      setActiveSuggestionIndex(-1)
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  const waiting = suggestionQuery !== searchValue.trim()
  const searchItems = waiting || searchSuggestions.isError ? [] : (searchSuggestions.data?.data?.suggestions || []).slice(0, 5).map(item => ({ kind: 'search', item }))
  const writerItems = waiting || searchSuggestions.isError ? [] : (searchSuggestions.data?.data?.writers || []).slice(0, 5).map(item => ({ kind: 'writer', item }))
  const trendingItems = getTrendingSearches(popularSearches.data?.data).map(title => ({ kind: 'search', item: { text: title.slice(0, 100), label: title } }))
  const topicItems = suggestedSearchTopics.map(topic => ({ kind: 'search', item: { text: topic } }))
  const hasSearchText = searchValue.trim().length > 0
  const suggestionItems = hasSearchText ? [...searchItems, ...writerItems] : [...trendingItems, ...topicItems]

  const suggestionsVisible = searchOpen && !mobileSearchOrigin

  useEffect(() => {
    setActiveSuggestionIndex(current => current < suggestionItems.length ? current : -1)
  }, [suggestionItems.length])

  useEffect(() => {
    const panel = suggestionsRef.current
    const option = panel?.querySelector('[role="option"][aria-selected="true"]')
    if (!option) return
    const bounds = panel.getBoundingClientRect()
    const row = option.getBoundingClientRect()
    if (row.top < bounds.top) panel.scrollTop += row.top - bounds.top
    else if (row.bottom > bounds.bottom) panel.scrollTop += row.bottom - bounds.bottom
  }, [activeSuggestionIndex])

  const openSuggestion = (kind, item) => {
    setSearchOpen(false)
    setActiveSuggestionIndex(-1)
    navigate(kind === 'search' ? `/search?q=${encodeURIComponent(item.text)}` : `/author/${item.handle}`)
  }

  const handleSearchKeyDown = event => {
    if (event.key === 'Escape') {
      setSearchOpen(false)
      setActiveSuggestionIndex(-1)
      return
    }
    if (event.key === 'Tab') {
      setSearchOpen(false)
      setActiveSuggestionIndex(-1)
      return
    }
    if (!suggestionsVisible || !suggestionItems.length || !['ArrowDown', 'ArrowUp'].includes(event.key)) return

    event.preventDefault()
    setActiveSuggestionIndex(current => {
      if (current < 0) return event.key === 'ArrowDown' ? 0 : suggestionItems.length - 1
      return (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestionItems.length) % suggestionItems.length
    })
  }

  const handleAccountMenuKeyDown = event => {
    const items = [...(accountMenuRef.current?.querySelectorAll('[role="menuitem"]') || [])]
    if (!items.length) return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpenMenu(false)
      accountButtonRef.current?.focus()
      return
    }
    if (event.key === 'Tab') {
      setOpenMenu(false)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (Math.max(currentIndex, 0) + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[nextIndex].focus()
  }

  return (
    <nav aria-label="Global navigation" className="navbar-shell fixed top-0 w-full z-[100] h-14 flex items-center gap-4 px-4 md:px-8 border-b border-[var(--color-border)] bg-[var(--color-bg)]"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <Link to="/" aria-label="firstmargin home" className="flex items-center gap-2 shrink-0">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-accent)]"><LogoIcon /></div>
        <span className="hidden md:inline text-[18px] font-bold text-[var(--color-text)]">firstmargin</span>
      </Link>
      <form ref={searchRef} role="search" onSubmit={runSearch} className="min-w-0 flex-1 md:max-w-[660px] relative">
        <div className={`flex flex-wrap md:flex-nowrap items-center gap-[10px] bg-[var(--color-surface)] border rounded-full px-[14px] min-h-[38px] focus-within:border-[var(--color-accent)] ${searchOpen ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
          <SearchIcon />
          <input ref={searchInputRef} value={searchValue} onFocus={() => {
            if (closingMobileSearchRef.current) return
            if (window.matchMedia('(max-width: 767px)').matches) {
              const bounds = searchRef.current.getBoundingClientRect()
              setMobileSearchOrigin({ left: bounds.left, width: bounds.width })
            } else setSearchOpen(true)
          }} onClick={() => {
            if (window.matchMedia('(max-width: 767px)').matches && !mobileSearchOrigin) {
              closingMobileSearchRef.current = false
              const bounds = searchRef.current.getBoundingClientRect()
              setMobileSearchOrigin({ left: bounds.left, width: bounds.width })
            }
          }} onBlur={() => { closingMobileSearchRef.current = false }} onChange={event => { setSearchValue(event.target.value); setSearchOpen(true); setActiveSuggestionIndex(-1) }} onKeyDown={handleSearchKeyDown} placeholder="Search stories and writers…"
            maxLength={100} autoComplete="off" role="combobox" aria-label="Search stories and writers" aria-autocomplete="list" aria-expanded={suggestionsVisible} aria-controls="search-suggestions" aria-activedescendant={activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex] ? `search-suggestion-${activeSuggestionIndex}` : undefined} className="search-input min-w-0 flex-1 border-none bg-transparent py-[9px] text-[13px] text-[var(--color-text)] outline-none" />
          {searchValue && <button type="button" aria-label="Clear search" onClick={() => {
            setSearchValue('')
            setSuggestionQuery('')
            setSearchOpen(true)
            setActiveSuggestionIndex(-1)
            closingMobileSearchRef.current = true
            searchInputRef.current?.focus({ preventScroll: true })
            closingMobileSearchRef.current = false
          }} className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-[24px] text-[var(--color-text-secondary)] before:absolute before:-inset-[6px] hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">×</button>}
        </div>
        {suggestionsVisible && <ViewportPopover ref={suggestionsRef} anchorRef={searchRef} matchAnchorWidth id="search-suggestions" role="listbox" aria-label="Search suggestions" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[200] overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          {hasSearchText ? <><div role="status" aria-live="polite">
            {waiting || searchSuggestions.isPending ? <p className="px-4 py-5 text-[12px] text-[var(--color-text-muted)]">Searching…</p>
              : searchSuggestions.isError ? <p className="px-4 py-5 text-[12px] text-[var(--color-danger)]">Suggestions are unavailable. Press Enter to search.</p>
                : suggestionItems.length === 0 ? <p className="px-4 py-5 text-[12px] text-[var(--color-text-muted)]">No matching searches or authors yet.</p>
                  : <span className="sr-only">{suggestionItems.length} suggestions available</span>}
          </div>
          {[{ label: 'Search suggestions', items: searchItems, offset: 0 }, { label: 'Authors', items: writerItems, offset: searchItems.length }].filter(group => group.items.length).map(group => <div key={group.label} role="group" aria-label={group.label}>
            <h2 className="px-4 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)]">{group.label}</h2>
            {group.items.map(({ kind, item }, itemIndex) => { const index = group.offset + itemIndex; return <button id={`search-suggestion-${index}`} key={kind === 'search' ? item.text : item.id} type="button" role="option" tabIndex={-1} aria-selected={activeSuggestionIndex === index} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveSuggestionIndex(index)} onClick={() => openSuggestion(kind, item)} className={`flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--color-surface-hover)] ${activeSuggestionIndex === index ? 'bg-[var(--color-surface-hover)]' : ''}`}>
            {kind === 'search' ? <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-bg-alt)]"><SearchIcon /></span> : <Avatar src={item.avatarUrl} name={item.displayName} size={40} />}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[13px] font-semibold text-[var(--color-text)]">{kind === 'search' ? item.text : item.displayName}</span>
              {kind === 'writer' && <span className="mt-0.5 block break-words text-[11px] text-[var(--color-text-muted)]">@{item.handle}</span>}
            </span>
          </button> })}</div>)}
          </> : <>
            <div role="group" aria-label="Trending searches" className="pb-2">
              <h2 className="px-4 pt-3 text-[12px] font-semibold text-[var(--color-text-secondary)]">Trending searches</h2>
              {popularSearches.isPending ? <p role="status" className="px-4 py-3 text-[12px] text-[var(--color-text-muted)]">Loading suggestions…</p>
                : popularSearches.isError ? <div className="px-4 py-3 text-[12px] text-[var(--color-text-muted)]"><p>Trending suggestions are unavailable.</p><button type="button" onClick={() => popularSearches.refetch()} className="min-h-11 underline underline-offset-2" aria-busy={popularSearches.isFetching} disabled={popularSearches.isFetching}>Try again</button></div>
                  : !trendingItems.length ? <p className="px-4 py-3 text-[12px] text-[var(--color-text-muted)]">Explore a topic below while popular stories build up.</p>
                    : trendingItems.map(({ kind, item }, index) => <button id={`search-suggestion-${index}`} key={item.label} type="button" role="option" tabIndex={-1} aria-selected={activeSuggestionIndex === index} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveSuggestionIndex(index)} onClick={() => openSuggestion(kind, item)} className={`flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] ${activeSuggestionIndex === index ? 'bg-[var(--color-surface-hover)]' : ''}`}><SearchIcon /><span className="min-w-0 break-words">{item.label}</span></button>)}
            </div>
            <div role="group" aria-label="Suggested topics" className="border-t border-[var(--color-border-light)]">
              <h2 className="px-4 pt-3 text-[12px] font-semibold text-[var(--color-text-secondary)]">What are you curious about?</h2>
              {topicItems.map(({ kind, item }, topicIndex) => { const index = trendingItems.length + topicIndex; return <button id={`search-suggestion-${index}`} key={item.text} type="button" role="option" tabIndex={-1} aria-selected={activeSuggestionIndex === index} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveSuggestionIndex(index)} onClick={() => openSuggestion(kind, item)} className={`flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3 text-left text-[13px] text-[var(--color-text)] last:border-b-0 hover:bg-[var(--color-surface-hover)] ${activeSuggestionIndex === index ? 'bg-[var(--color-surface-hover)]' : ''}`}><span aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]"><SearchIcon /></span><span>{item.text}</span></button> })}
            </div>
          </>}
        </ViewportPopover>}
      </form>

      {loggedIn && <Link id="notification-trigger-mobile" to="/notifications" state={{ notificationBackground: location }} aria-haspopup="dialog" aria-label={`${notifications.data?.meta.unreadCount || 0} unread notifications`} title="Notifications" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)] before:absolute before:-inset-1 md:hidden"><span aria-hidden="true">♢</span>{notifications.data?.meta.unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[9px] text-[var(--color-text-inverted)]">{Math.min(99, notifications.data.meta.unreadCount)}</span>}</Link>}

      <div className="hidden md:flex items-center gap-2 shrink-0 ml-auto">
        {(!loggedIn || (!entitlements.isPending && !entitlements.isError && !isMember)) && <Link to="/membership" style={{ color: 'var(--color-text-inverted)' }} className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--color-accent)] px-[18px] text-[13px] font-medium whitespace-nowrap">Join</Link>}
        {loggedIn && <Link id="notification-trigger" to="/notifications" state={{ notificationBackground: location }} aria-haspopup="dialog" aria-label={`${notifications.data?.meta.unreadCount || 0} unread notifications`} title="Notifications" className="relative w-9 h-9 shrink-0 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)] flex items-center justify-center before:absolute before:-inset-1"><span aria-hidden="true">♢</span>{notifications.data?.meta.unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-accent)] text-[9px] text-[var(--color-text-inverted)] flex items-center justify-center">{Math.min(99, notifications.data.meta.unreadCount)}</span>}</Link>}
        {!loggedIn && <Button className="navbar-auth-action" variant="secondary" onClick={() => navigate('/login', { state: { returnTo: `${location.pathname}${location.search}${location.hash}` } })}>Sign In</Button>}
        <div ref={menuRef} className="relative">
          <button type="button" ref={accountButtonRef} onClick={() => setOpenMenu(value => !value)} aria-label="Open account menu" aria-haspopup="menu" aria-expanded={openMenu} aria-controls="account-menu"
            className="button-target inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-transparent p-0 text-[var(--color-text-inverted)] font-semibold text-[12px] uppercase [&>img]:border-0">
            {loggedIn ? <Avatar src={avatarUrl} name={user} size={28} /> : <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)]"><UserIcon /></span>}
          </button>
          {openMenu && <ViewportPopover ref={accountMenuRef} anchorRef={accountButtonRef} onAnchorHidden={() => setOpenMenu(false)} id="account-menu" role="menu" tabIndex={-1} aria-label="Account" onKeyDown={handleAccountMenuKeyDown} className="absolute right-0 top-[calc(100%+8px)] z-[200] w-[280px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-float)]">
            {loggedIn ? <div className="flex min-w-0 items-center gap-3 border-b border-[var(--color-border)] px-3 py-3">
              <Avatar src={avatarUrl} name={user} size={40} />
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-[var(--color-text)]">{user}</p>{roleLabel(role) && <span className="mt-1 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">{roleLabel(role)}</span>}</div>
              <button type="button" role="menuitem" aria-label="Sign-out options" title="Sign out" onClick={() => { setOpenMenu(false); setSignOutOpen(true) }} className="button-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 7l5 5-5 5m5-5H9" /></svg></button>
            </div> : <p className="px-3 py-3 text-[13px] font-semibold text-[var(--color-text)]">Account</p>}
            {loggedIn && <><p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Your space</p>
            {[{ label: 'Profile', detail: 'Identity and published work', path: '/profile', icon: UserIcon }, { label: 'Library', detail: 'Saved stories and history', path: '/saved', icon: BookmarkIcon }, ...(['moderator', 'admin'].includes(role) ? [{ label: 'Staff console', detail: 'Moderation and operations', path: '/staff', icon: SettingsIcon }] : [])].map(item => {
              const Icon = item.icon
              return <Link key={item.label} role="menuitem" aria-label={item.label} to={item.path} onClick={() => setOpenMenu(false)} className="flex min-h-12 items-center gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[var(--color-bg-alt)] focus-visible:bg-[var(--color-bg-alt)] focus:outline-none"><span aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]"><Icon /></span><span className="min-w-0"><span className="block text-[13px] font-semibold text-[var(--color-text)]">{item.label}</span><span className="block text-[11px] text-[var(--color-text-muted)]">{item.detail}</span></span></Link>
            })}</>}
            {loggedIn && canManageMembership && <div><button type="button" role="menuitem" aria-label="Manage membership" onClick={() => manageMembership.mutate()} disabled={manageMembership.isPending} aria-busy={manageMembership.isPending} className="flex min-h-12 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[var(--color-bg-alt)] focus-visible:bg-[var(--color-bg-alt)] focus:outline-none"><span aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]"><MembershipIcon /></span><span className="min-w-0"><span className="block text-[13px] font-semibold text-[var(--color-text)]">Manage membership</span><span className="block text-[11px] text-[var(--color-text-muted)]">Billing and renewal settings</span></span></button>{manageMembership.isError && <p role="alert" className="px-3 py-2 text-[12px] text-[var(--color-danger)]">Membership management is unavailable. Please try again.</p>}</div>}
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Support & preferences</p>
              <Link role="menuitem" to="/help" onClick={() => setOpenMenu(false)} className="flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] focus-visible:bg-[var(--color-bg-alt)] focus:outline-none"><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">?</span>Help</Link>
              <Link role="menuitem" to="/settings" onClick={() => setOpenMenu(false)} className="flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] focus-visible:bg-[var(--color-bg-alt)] focus:outline-none"><span aria-hidden="true" className="shrink-0"><SettingsIcon /></span>Settings</Link>
            </div>
          </ViewportPopover>}
        </div>
      </div>
      {loggedIn && signOutOpen && <SignOutDialog onClose={() => setSignOutOpen(false)} returnFocusRef={accountButtonRef} onSignOut={signOut} onSignOutAll={signOutAllDevices} pending={isSigningOut} />}
      {mobileSearchOrigin && <MobileSearchDialog initialQuery={searchValue} origin={mobileSearchOrigin} onClose={closeMobileSearch} />}
    </nav>
  )
}
