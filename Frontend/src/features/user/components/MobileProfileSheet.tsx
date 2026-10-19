import ModalHeader from '@/shared/components/ui/ModalHeader'
import useOverlayViewport from '@/shared/hooks/useOverlayViewport'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useReducedMotion from '@/shared/hooks/useReducedMotion'
import useAuth from '@/features/auth/hooks/useAuth'
import Avatar from '@/shared/components/ui/Avatar'
import { BookmarkIcon, MembershipIcon, PenIcon, SettingsIcon, UserIcon } from '@/shared/icons'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { useSelector } from 'react-redux'
import roleLabel from '../utils/roleLabel'
import useEntitlements from '@/features/membership/hooks/useEntitlements'
import useManageMembership from '@/features/membership/hooks/useManageMembership'

export default function MobileProfileSheet({ onClose }: { onClose: () => void }) {
  const auth = useAuth()
  const role = useSelector((state: { auth: { role: string | null } }) => state.auth.role)
  const entitlements = useEntitlements(auth.loggedIn)
  const isMember = ['active', 'trialing'].includes(entitlements.data?.membership?.status)
  const canManageMembership = isMember && role !== 'admin'
  const manageMembership = useManageMembership()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  const reducedMotion = useReducedMotion()
  const [closing, setClosing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const destination = useRef<string | null>(null)
  const signInRequested = useRef(false)
  const finished = useRef(false)
  const requestClose = useCallback(() => setClosing(true), [])
  const viewportStyle = useOverlayViewport()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const focusRef = useDialogFocus(requestClose, closeButtonRef)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    // Native autofocus must not scroll the entering panel into view mid-slide.
    if (dialog) dialog.scrollTop = 0
    closeButtonRef.current?.focus({ preventScroll: true })
    const media = window.matchMedia('(min-width: 768px)')
    const handleResize = () => { if (media.matches) onClose() }
    media.addEventListener('change', handleResize)
    return () => { media.removeEventListener('change', handleResize); dialog?.close() }
  }, [onClose])

  const finishClose = () => {
    if (!closing || finished.current) return
    finished.current = true
    onClose()
    if (signInRequested.current) requestAnimationFrame(() => auth.signIn())
    if (destination.current) navigate(destination.current, { state: destination.current === '/signup' ? { returnTo } : undefined })
  }

  const followLink = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    destination.current = path
    requestClose()
  }
  const rowClass = 'flex min-h-14 w-full items-center gap-3 border-b border-[var(--color-border-light)] py-3 text-left text-[14px] font-medium'

  return createPortal(<dialog style={viewportStyle} id="mobile-profile-sheet" autoFocus tabIndex={-1} ref={element => { dialogRef.current = element; focusRef.current = element }} aria-labelledby="profile-sheet-title" onCancel={event => { event.preventDefault(); requestClose() }} className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-[var(--color-text)] backdrop:bg-transparent">
    <motion.div aria-hidden="true" className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.28 }} onClick={requestClose} />
    <motion.section data-profile-sheet="true" initial={reducedMotion ? false : { y: '100%' }} animate={{ y: closing ? '100%' : 0 }} transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.2, 0.8, 0.2, 1] }} onAnimationComplete={finishClose} className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] max-h-[calc(var(--overlay-height)_-_1rem)] flex-col overflow-hidden rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
      <div aria-hidden="true" className="shrink-0 bg-[var(--color-surface)] px-5 pt-3"><div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-border)]" /></div>
      <ModalHeader title="Account" titleId="profile-sheet-title" onClose={requestClose} closeLabel="Close account menu" closeRef={closeButtonRef} />
      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {auth.loggedIn ? <Link to="/profile" onClick={event => followLink(event, '/profile')} className={`${rowClass} mb-3`}>
          <Avatar src={auth.avatarUrl} name={auth.user} size={44} />
          <span className="min-w-0 flex-1"><span className="block text-[12px] text-[var(--color-text-secondary)]">{auth.user}</span><span className="block">Profile</span>{roleLabel(role) && <span className="mt-1 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">{roleLabel(role)}</span>}</span><span aria-hidden="true">→</span>
        </Link> : <div className="mb-5 grid grid-cols-2 gap-3">
          <Link to="/signup" state={{ returnTo }} onClick={event => followLink(event, '/signup')} style={{ color: 'var(--color-text-inverted)' }} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 text-[13px] font-semibold">Sign Up</Link>
          <button type="button" onClick={() => { signInRequested.current = true; requestClose() }} aria-haspopup="dialog" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-4 text-[13px] font-semibold">Sign In</button>
        </div>}
        <nav aria-label="Account menu">
          {auth.loggedIn && [{ path: '/saved', label: 'Library' }, { path: '/studio', label: 'Studio' }, { path: '/members', label: 'Member Hub' }].map(item => <Link key={item.path} to={item.path} onClick={event => followLink(event, item.path)} className={rowClass}>{item.path === '/saved' ? <BookmarkIcon /> : item.path === '/studio' ? <PenIcon /> : <MembershipIcon />}<span className="flex-1">{item.label}</span><span aria-hidden="true">→</span></Link>)}
          {auth.loggedIn && ['moderator', 'admin'].includes(role) && <Link to="/staff" onClick={event => followLink(event, '/staff')} className={rowClass}><SettingsIcon /><span className="flex-1">Staff console</span><span aria-hidden="true">→</span></Link>}
          {canManageMembership ? <button type="button" disabled={manageMembership.isPending} aria-busy={manageMembership.isPending} onClick={() => manageMembership.mutate()} className={rowClass}><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">✦</span><span className="flex-1">Manage membership</span><span aria-hidden="true">→</span></button> : (!isMember && (!auth.loggedIn || (!entitlements.isPending && !entitlements.isError))) && <Link to="/membership" onClick={event => followLink(event, '/membership')} className={rowClass}><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">✦</span><span className="flex-1">Join</span><span aria-hidden="true">→</span></Link>}
          {manageMembership.isError && <p role="alert" className="py-2 text-[12px] text-[var(--color-danger)]">Membership management is unavailable. Please try again.</p>}
          <Link to="/settings" onClick={event => followLink(event, '/settings')} className={rowClass}><SettingsIcon /><span className="flex-1">Settings</span><span aria-hidden="true">→</span></Link>
          <button type="button" aria-expanded={helpOpen} aria-controls="profile-sheet-help" onClick={() => setHelpOpen(value => !value)} className={`button-target ${rowClass}`}><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[11px]">?</span><span className="flex-1">Help</span><span aria-hidden="true">{helpOpen ? '−' : '+'}</span></button>
        </nav>
        {helpOpen && <section id="profile-sheet-help" aria-label="Help" className="border-b border-[var(--color-border-light)] py-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          <p>Discover stories in Explore. Sign in to save stories, follow writers, and publish your own writing. Theme and language options are in Settings.</p>
          <div className="mt-2 flex flex-wrap gap-x-5"><Link to="/explore/trending" onClick={event => followLink(event, '/explore/trending')} className="inline-flex min-h-11 items-center underline underline-offset-4">Explore stories</Link><Link to="/explore/questions" onClick={event => followLink(event, '/explore/questions')} className="inline-flex min-h-11 items-center underline underline-offset-4">Reader questions</Link></div>
        </section>}
        <section aria-label="Social links" className="mt-5">
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">Socials</p>
          <div className="flex flex-wrap gap-3">
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] px-4 text-[13px]">Instagram <span aria-hidden="true" className="ml-2">↗</span></a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] px-4 text-[13px]">LinkedIn <span aria-hidden="true" className="ml-2">↗</span></a>
          </div>
        </section>
        {auth.loggedIn && <button type="button" disabled={auth.isSigningOut} aria-busy={auth.isSigningOut} onClick={auth.signOut} className="mt-5 flex min-h-11 items-center gap-3 text-[13px] text-[var(--color-text-secondary)]"><UserIcon />Sign Out</button>}
      </div>
    </motion.section>
  </dialog>, document.body)
}
