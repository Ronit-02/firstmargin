import ReportForm from '@/shared/components/ui/ReportForm'
import ReportModal, { reportTitle } from '@/shared/components/ui/ReportModal'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import ActionMenu, { ActionMenuTrigger, ActionMenuItem, HideActionIcon } from '@/shared/components/ui/ActionMenu'
import { useId, useRef, useState } from 'react'
import useAuth from '@/features/auth/hooks/useAuth'
import useReportPost from '@/features/post/hooks/useReportPost'
import useToast from '@/shared/hooks/useToast'
import BookmarkIcon from '@/shared/icons/BookmarkIcon'
import LinkIcon from '@/shared/icons/LinkIcon'
import { AddToCollectionDialog } from '@/features/collection'
import AddToSeriesDialog, { SeriesActionIcon } from './AddToSeriesDialog'

const InfoIcon = () => <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>
const FlagIcon = () => <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 21V3h14l-3 5 3 5H5" /></svg>

export default function PostCardMenu({ post, onHide, variant = 'list', compactMobile = false }) {
  const { loggedIn, signIn } = useAuth()
  const { notify } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)
  const triggerRef = useRef(null)
  const reportMutation = useReportPost(post.id)
  const reportSubject = variant === 'short' || post.format === 'short' ? 'short' : 'post'
  const instanceId = useId()
  const menuId = `story-menu-${instanceId}`
  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const requireAuth = action => {
    if (!loggedIn) return signIn()
    action()
  }

  const handleNotInterested = () => {
    onHide?.(post)
    setMenuOpen(false)
    notify('Story hidden from this list.', { tone: 'info' })
  }

  return <>
    <div className={`${variant === 'grid' ? 'absolute right-3 top-3 z-20' : 'relative z-20 shrink-0'} ${compactMobile ? 'max-[540px]:-my-2' : ''}`}>
      <ActionMenuTrigger
        ref={triggerRef}
        type="button"
        aria-label={`More options for ${post.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={event => { event.stopPropagation(); setMenuOpen(value => !value) }}
      />
      {menuOpen && <ActionMenu anchorRef={triggerRef} onClose={closeMenu} id={menuId} label={`Options for ${post.title}`}>
        <ActionMenuItem icon={<BookmarkIcon filled={post.isBookmarked} />} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); requireAuth(() => { closeMenu(); setSaveOpen(true) }) }}>{post.isBookmarked ? 'Saved' : 'Save story'}</ActionMenuItem>
        {post.canAddToSeries && <ActionMenuItem icon={<SeriesActionIcon />} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); closeMenu(); setSeriesOpen(true) }}>Add to series</ActionMenuItem>}
        <ActionMenuItem icon={<LinkIcon />} onClick={event => { event.stopPropagation(); closeMenu(); setShareOpen(true) }}>Share link</ActionMenuItem>
        {onHide && <>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <ActionMenuItem icon={<InfoIcon />} aria-expanded={showWhy} onClick={event => { event.stopPropagation(); setShowWhy(value => !value) }}><span className="flex-1">Why you’re seeing this</span><span aria-hidden="true">{showWhy ? '−' : '+'}</span></ActionMenuItem>
          {showWhy && <p className="px-3 pb-2 text-[11px] leading-5 text-[var(--color-text-muted)]">{post.recommendationReason || 'This story is part of the current discovery feed.'}</p>}
          <ActionMenuItem icon={<HideActionIcon />} onClick={event => { event.stopPropagation(); handleNotInterested() }}>Not interested</ActionMenuItem>
        </>}
        <ActionMenuItem icon={<FlagIcon />} tone="danger" aria-haspopup="dialog" onClick={event => { event.stopPropagation(); requireAuth(() => { reportMutation.reset(); closeMenu(); setReportOpen(true) }) }}>{reportTitle(reportSubject)}</ActionMenuItem>
      </ActionMenu>}
    </div>
    {reportOpen && <ReportModal title={reportTitle(reportSubject)} onClose={() => setReportOpen(false)} returnFocusRef={triggerRef}>
      <ReportForm subject={reportSubject} mutation={reportMutation} onClose={() => setReportOpen(false)} />
    </ReportModal>}
    {shareOpen && <ShareMenu anchorRef={triggerRef} id={`story-share-${instanceId}`} label="Share story" contentName="Story" url={`${window.location.origin}/post/${post.id}`} onClose={({ restoreFocus = false } = {}) => { setShareOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()) }} />}
    {saveOpen && <AddToCollectionDialog postId={post.id} title={post.title} isBookmarked={Boolean(post.isBookmarked)} saveMode returnFocusRef={triggerRef} onClose={() => setSaveOpen(false)} />}
    {seriesOpen && <AddToSeriesDialog postId={post.id} title={post.title} format={post.format === 'short' ? 'short' : 'article'} returnFocusRef={triggerRef} onClose={() => setSeriesOpen(false)} />}
  </>
}
