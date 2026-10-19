import ModalHeader from '@/shared/components/ui/ModalHeader'
import { AddToCollectionDialog } from '@/features/collection'
import retainRetryView from '@/shared/utils/retainRetryView'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '@/shared/components/ui/Avatar'
import Tag from '@/shared/components/ui/Tag'
import BookmarkIcon from '@/shared/icons/BookmarkIcon'
import ShareIcon from '@/shared/icons/ShareIcon'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import Button from '@/shared/components/ui/Button'
import Divider from '@/shared/components/ui/Divider'
import PostBody from '@/features/post/pages/PostBody'
import CommentsSection from '@/features/post/pages/CommentsSection'
import useFetchPost from '@/features/post/hooks/useFetchPost'
import usePostLike from '@/features/post/hooks/usePostLike'
import AppreciationButton from '@/features/post/components/AppreciationButton'
import useAuth from '@/features/auth/hooks/useAuth'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { ShortDetailSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import { createInteractionEvent, recordInteractionEvents } from '../api/events'
import { AnimatePresence, motion } from 'framer-motion'
import useReducedMotion from '@/shared/hooks/useReducedMotion'
import useFittingPills from '@/shared/hooks/useFittingPills'

const WHEEL_EDGE_THRESHOLD = 100
const WHEEL_GESTURE_GAP = 220
const CARD_TRANSITION_MS = 800
const TOUCH_EDGE_THRESHOLD = 100

const newWheelGesture = () => ({ direction: 0, time: 0, edgeDistance: 0, edgeEvents: 0, scrolledContent: false, navigated: false })

const parseBlocks = body => {
  try {
    const blocks = JSON.parse(body)
    return Array.isArray(blocks) ? blocks : null
  } catch {
    return null
  }
}

export default function ShortReadModal({ postId, onClose, onNavigate, onNavigateAway, listIds = [] }) {
  const returnFocusRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const lastGestureRef = useRef(0)
  const [selection, setSelection] = useState({ source: postId, id: postId })
  const [direction, setDirection] = useState(1)
  const activeId = selection.source === postId ? selection.id : postId
  const navigate = (id, requestedDirection) => {
    const currentIndex = listIds.indexOf(activeId)
    const nextIndex = listIds.indexOf(id)
    setDirection(requestedDirection || (currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? -1 : 1))
    if (onNavigate) onNavigate(id)
    else setSelection({ source: postId, id })
  }
  const listIndex = listIds.indexOf(activeId)
  const navigateList = (direction, gesture = false) => {
    const nextId = listIds[listIndex + direction]
    if (!nextId || (gesture && Date.now() - lastGestureRef.current < CARD_TRANSITION_MS)) return false
    lastGestureRef.current = Date.now()
    navigate(nextId, direction)
    return true
  }
  return <ShortReader returnFocusRef={returnFocusRef} postId={activeId} onClose={onClose} onNavigateAway={onNavigateAway} listPosition={listIndex} listCount={listIds.length} onNavigateList={navigateList} transitionDirection={direction} />
}

function ShortReader({ postId, onClose, onNavigateAway, returnFocusRef, listPosition, listCount, onNavigateList, transitionDirection }) {
  const closeButtonRef = useRef(null)
  const readingPaneRef = useRef(null)
  const touchStartRef = useRef(null)
  const commentsTriggerRef = useRef(null)
  const commentsCloseRef = useRef(null)
  const wheelGestureRef = useRef(newWheelGesture())
  const edgeNudgeTimeoutRef = useRef(null)
  const transitionUntilRef = useRef(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const shareTriggerRef = useRef(null)
  const saveTriggerRef = useRef(null)
  const previousPostRef = useRef(postId)
  const reducedMotion = useReducedMotion()
  const { loggedIn, signIn, user } = useAuth()
  const postQuery = retainRetryView(useFetchPost(postId))
  const likeMutation = usePostLike(postId)
  const post = postQuery.data
  const tags = post?.tags || []
  const { containerRef: tagsRef, visibleCount: visibleTags } = useFittingPills(tags)
  const blocks = post ? parseBlocks(post.body) : null
  const authorHandle = post?.author?.handle || post?.author?.username?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const handleClose = useCallback(() => onClose(), [onClose])
  const dialogRef = useDialogFocus(handleClose, closeButtonRef)

  useEffect(() => {
    if (previousPostRef.current === postId) return
    previousPostRef.current = postId
    setCommentsOpen(false)
  }, [postId])

  useLayoutEffect(() => {
    clearTimeout(edgeNudgeTimeoutRef.current)
    // Keep the wheel stream's navigation lock across keyed card replacements.
    if (previousPostRef.current !== postId) transitionUntilRef.current = Date.now() + (reducedMotion ? 0 : CARD_TRANSITION_MS)
    if (readingPaneRef.current) readingPaneRef.current.scrollTop = 0
    if (dialogRef.current) {
      dialogRef.current.style.transition = 'none'
      dialogRef.current.style.transform = 'translate3d(0, 0px, 0)'
    }
    closeButtonRef.current?.focus({ preventScroll: true })
    // Animate the complete card, including its surface/border/footer, before
    // paint. The focus trap and input listener remain on the same DOM node.
    const entrance = reducedMotion ? null : dialogRef.current?.animate([
      { transform: `translate3d(0, ${transitionDirection * window.innerHeight}px, 0)`, opacity: 0.72 },
      { transform: 'translate3d(0, 0px, 0)', opacity: 1 },
    ], { duration: CARD_TRANSITION_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })
    return () => entrance?.cancel()
  }, [dialogRef, postId, reducedMotion, transitionDirection])

  useEffect(() => () => clearTimeout(edgeNudgeTimeoutRef.current), [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  const recordedOpen = useRef(false)
  useEffect(() => {
    if (!post?._id || recordedOpen.current) return
    recordedOpen.current = true
    recordInteractionEvents([createInteractionEvent({ eventType: 'open', postId: post._id, writerId: post.author?._id, surface: 'article' })]).catch(() => {})
  }, [post])

  const handleLike = () => {
    if (!loggedIn) return signIn()
    likeMutation.mutate(!post.isLiked)
  }

  const handleBookmark = () => {
    if (!loggedIn) return signIn()
    setSaveOpen(true)
  }
  const closeComments = () => {
    setCommentsOpen(false)
    requestAnimationFrame(() => commentsTriggerRef.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (commentsOpen) commentsCloseRef.current?.focus({ preventScroll: true })
  }, [commentsOpen])

  const atEdge = (element, direction) => direction > 0
    ? element.scrollTop + element.clientHeight >= element.scrollHeight - 2
    : element.scrollTop <= 2
  const interactiveTarget = target => target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"]'))
  const setEdgeOffset = (offset, settle = false) => {
    const content = dialogRef.current
    if (!content) return
    content.style.transition = settle && !reducedMotion ? 'transform 180ms ease-out' : 'none'
    content.style.transform = `translate3d(0, ${reducedMotion ? 0 : offset}px, 0)`
  }
  const canNavigate = direction => direction > 0 ? listPosition < listCount - 1 : listPosition > 0
  const showEdgeNudge = (direction, distance, threshold, release = false) => {
    clearTimeout(edgeNudgeTimeoutRef.current)
    setEdgeOffset(canNavigate(direction) ? -direction * Math.min(distance, threshold) : 0)
    if (release) edgeNudgeTimeoutRef.current = setTimeout(() => setEdgeOffset(0, true), WHEEL_GESTURE_GAP)
  }
  const handleWheelNavigation = event => {
    const target = event.target
    if (!(target instanceof Element) || listPosition < 0 || listCount < 2 || event.ctrlKey) return
    if (commentsOpen || shareOpen || saveOpen || target.closest('[data-short-comments-overlay]')) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    const pane = readingPaneRef.current
    const inPane = pane?.contains(target)
    if (!inPane && interactiveTarget(target)) return

    // React's delegated wheel listeners may be passive. One native, cancellable
    // listener owns both content and edge scrolling, including replacement panes.
    event.preventDefault()
    const now = Date.now()
    let gesture = wheelGestureRef.current
    if (now - gesture.time >= WHEEL_GESTURE_GAP) {
      gesture = newWheelGesture()
      wheelGestureRef.current = gesture
    }
    gesture.time = now
    if (gesture.navigated || now < transitionUntilRef.current || postQuery.isPending) return

    const direction = Math.sign(event.deltaY)
    const pixels = Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pane?.clientHeight || window.innerHeight : 1)
    if (gesture.direction !== direction) {
      gesture.direction = direction
      gesture.edgeDistance = 0
      gesture.edgeEvents = 0
      setEdgeOffset(0, true)
    }
    if (pane && !atEdge(pane, direction)) {
      pane.scrollTop += direction * pixels
      gesture.scrolledContent = true
      gesture.edgeDistance = 0
      gesture.edgeEvents = 0
      setEdgeOffset(0, true)
      return
    }
    // Momentum from reading belongs to that short until the wheel stream ends.
    // No scrollend support or hardware classification is needed to re-arm.
    if (gesture.scrolledContent || !canNavigate(direction)) return
    gesture.edgeDistance += pixels
    gesture.edgeEvents += 1
    const singleWheelTick = inPane && pane.scrollHeight > pane.clientHeight + 2 && pixels >= WHEEL_EDGE_THRESHOLD && pixels <= 240
    if (gesture.edgeDistance < WHEEL_EDGE_THRESHOLD || (!singleWheelTick && gesture.edgeEvents < 2)) {
      showEdgeNudge(direction, gesture.edgeDistance, WHEEL_EDGE_THRESHOLD, true)
      return
    }
    clearTimeout(edgeNudgeTimeoutRef.current)
    gesture.navigated = onNavigateList(direction, true)
    if (!gesture.navigated) setEdgeOffset(0, true)
  }

  const handleTouchStart = event => {
    const pane = readingPaneRef.current
    const touch = event.touches[0]
    touchStartRef.current = touch && event.touches.length === 1 && pane?.contains(event.target) && !interactiveTarget(event.target) && !commentsOpen && !shareOpen && !saveOpen && !postQuery.isPending && Date.now() >= transitionUntilRef.current
      ? { x: touch.clientX, y: touch.clientY, atTop: atEdge(pane, -1), atBottom: atEdge(pane, 1) }
      : null
  }
  const handleTouchMove = event => {
    const start = touchStartRef.current
    const touch = event.touches[0]
    if (!start || !touch) return
    const deltaY = start.y - touch.clientY
    if (Math.abs(deltaY) <= Math.abs(start.x - touch.clientX)) return
    const direction = Math.sign(deltaY)
    if ((direction > 0 && !start.atBottom) || (direction < 0 && !start.atTop)) return
    event.preventDefault()
    showEdgeNudge(direction, Math.abs(deltaY), TOUCH_EDGE_THRESHOLD)
  }
  const handleTouchEnd = event => {
    const start = touchStartRef.current
    touchStartRef.current = null
    setEdgeOffset(0, true)
    if (!start || listPosition < 0) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaY = start.y - touch.clientY
    if (Math.abs(deltaY) < TOUCH_EDGE_THRESHOLD || Math.abs(deltaY) < Math.abs(start.x - touch.clientX)) return
    if (deltaY > 0 && start.atBottom) onNavigateList(1, true)
    if (deltaY < 0 && start.atTop) onNavigateList(-1, true)
  }
  const handleTouchCancel = () => {
    touchStartRef.current = null
    setEdgeOffset(0, true)
  }

  // The dialog survives card changes; the reading pane does not. Rebind the
  // current closures after render, without resetting the gesture kept in a ref.
  useEffect(() => {
    const dialog = dialogRef.current?.closest('dialog')
    if (!dialog) return undefined
    // Close the in-reader discussion before the shared native focus trap sees Escape.
    const handleCommentsEscape = event => {
      if (event.key !== 'Escape' || !commentsOpen) return
      event.preventDefault()
      event.stopPropagation()
      closeComments()
    }
    const listeners = { wheel: handleWheelNavigation, touchstart: handleTouchStart, touchmove: handleTouchMove, touchend: handleTouchEnd, touchcancel: handleTouchCancel }
    Object.entries(listeners).forEach(([type, listener]) => dialog.addEventListener(type, listener, { passive: false }))
    dialog.addEventListener('keydown', handleCommentsEscape, true)
    return () => {
      Object.entries(listeners).forEach(([type, listener]) => dialog.removeEventListener(type, listener))
      dialog.removeEventListener('keydown', handleCommentsEscape, true)
    }
  })

  return <ModalLayer returnFocusRef={returnFocusRef} onDismiss={onClose} aria-busy={postQuery.isPending} aria-labelledby={post && blocks ? 'short-read-title' : 'short-read-dialog-label'} className="flex items-end justify-center p-0 backdrop:backdrop-blur-[2px] sm:items-center sm:p-5">
    <div className="relative w-full max-w-[440px]">
    <section ref={dialogRef} data-short-content tabIndex={-1} className="relative flex h-[calc(var(--overlay-height)*0.94)] w-full flex-col overflow-hidden rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_70px_rgba(0,0,0,0.24)] sm:h-[calc(var(--overlay-height)*0.88)] sm:rounded-[16px]">
      <div key={postId} data-short-reader-card className="flex min-h-0 flex-1 flex-col">
      <ModalHeader title="Short" titleId="short-read-dialog-label" subtitle="A focused idea from the firstmargin community" onClose={onClose} closeLabel="Close short" closeRef={closeButtonRef} />

      <div ref={readingPaneRef} data-short-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-8">
        {postQuery.isPending && <ShortDetailSkeleton />}
        {postQuery.isError && <div className="py-16 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">This short could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => postQuery.refetch()} aria-busy={postQuery.isFetching} disabled={postQuery.isFetching}>Try again</Button></div>}
        {post && !blocks && <div className="py-16 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">This short could not be displayed.</p><Button className="mt-4" variant="secondary" onClick={onClose}>Close</Button></div>}
        {post && blocks && <>
          {post.coverImage && <img src={post.coverImage} alt="" className="mx-auto mb-6 aspect-[4/5] w-full max-w-[320px] rounded-[10px] object-cover" />}
          <h2 id="short-read-title" className="text-[clamp(23px,5vw,28px)] font-medium leading-[1.2] tracking-[-0.045em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{post.title}</h2>
          <div className="mt-4 flex items-center gap-3">
            {authorHandle ? <Link to={`/author/${encodeURIComponent(authorHandle)}`} onClick={onNavigateAway || onClose} aria-label={`Open writer profile for ${post.author.username}`} className="shrink-0 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><Avatar src={post.author?.picture} name={post.author?.username} size={34} /></Link> : <Avatar src={post.author?.picture} name={post.author?.username} size={34} />}
            <div className="min-w-0">
              {authorHandle ? <Link to={`/author/${encodeURIComponent(authorHandle)}`} onClick={onNavigateAway || onClose} aria-label={`View ${post.author.username}'s profile`} className="block w-fit max-w-full rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><p className="truncate text-[12px] font-semibold text-[var(--color-text)]">{post.author?.username}</p></Link> : <p className="truncate text-[12px] font-semibold text-[var(--color-text)]">{post.author?.username}</p>}
              <p className="text-[11px] text-[var(--color-text-muted)]">{post.readTime || 'Short'}</p>
            </div>
          </div>
          {tags.length > 0 && <div ref={tagsRef} aria-label="Short tags" className={`flex min-w-0 flex-nowrap gap-2 overflow-hidden ${visibleTags > 0 ? 'mt-4' : 'h-0'}`}>{tags.map((tag, index) => <span key={tag} aria-hidden={index >= visibleTags} className={`shrink-0 ${index >= visibleTags ? 'invisible' : ''}`}><Tag label={tag} clickable={index < visibleTags} searchType="shorts" /></span>)}</div>}
          {likeMutation.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">We couldn't update this short. Please try again.</p>}
          <Divider className="my-7" />
          {post.depthContext?.deeper && <aside className="mb-7 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Go deeper</p>
            <p className="mt-1 text-[13px] font-semibold">{post.depthContext.deeper.title}</p>
            <Link to={`/post/${post.depthContext.deeper.id}`} onClick={onNavigateAway || onClose} className="button-target mt-3 inline-flex min-h-10 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px]">Read full story →</Link>
          </aside>}
          <PostBody body={blocks} compact />
          {post.seriesContext && <nav aria-label="Series progression" className="mt-7 border-t border-[var(--color-border)] pt-3">
            <Link to={`/series/${post.seriesContext.id}`} onClick={onNavigateAway || onClose} aria-label={`View series: ${post.seriesContext.title}`} className="button-target flex min-h-11 min-w-0 flex-col items-start gap-1 rounded-[8px] px-2 py-1 text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] min-[376px]:flex-row min-[376px]:items-center min-[376px]:gap-3"><span className="block w-full min-w-0 min-[376px]:flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">This short is part of a series{Number.isInteger(post.seriesContext.position) && Number.isInteger(post.seriesContext.total) ? ` · Part ${post.seriesContext.position + 1} of ${post.seriesContext.total}` : ''}</span><span data-series-next-title className="block truncate whitespace-nowrap text-[14px] font-semibold leading-5">{post.seriesContext.title}</span></span><span data-series-next-action aria-hidden="true" className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[var(--color-accent)] min-[376px]:text-[18px]"><span className="min-[376px]:hidden">View series →</span><span className="hidden min-[376px]:inline">→</span></span></Link>
          </nav>}
        </>}
      </div>
      {postQuery.isPending && <footer aria-hidden="true" className="grid shrink-0 grid-cols-4 gap-1 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 sm:px-7">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="mx-auto h-5 w-5 rounded-full" />)}</footer>}
      {post && blocks && <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 sm:px-7">
        {loggedIn && <p className="sr-only">Commenting as {user || 'you'}</p>}
        <div role="group" aria-label="Short actions" className="grid grid-cols-4 items-center gap-1">
          <AppreciationButton isLiked={post.isLiked} count={post.likesCount} label={post.isLiked ? 'Remove appreciation' : 'Appreciate this short'} disabled={likeMutation.isPending} onClick={handleLike} />
          <button ref={commentsTriggerRef} type="button" onClick={() => setCommentsOpen(value => !value)} aria-label={`Comments (${post.commentsCount || 0})`} aria-expanded={commentsOpen} aria-controls="short-read-comments" className="button-target flex min-w-0 items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.8L3 21l1.3-4.1A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" /></svg><span>{post.commentsCount || 0}</span></button>
          <button ref={saveTriggerRef} type="button" onClick={handleBookmark} aria-label={post.isBookmarked ? 'Manage saved short' : 'Save this short'} aria-haspopup="dialog" aria-pressed={post.isBookmarked} className={`button-target flex min-w-0 items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1 text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${post.isBookmarked ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}><BookmarkIcon filled={post.isBookmarked} /></button>
          <button ref={shareTriggerRef} type="button" onClick={() => setShareOpen(true)} aria-label="Share this short" aria-haspopup="dialog" aria-expanded={shareOpen} aria-controls={shareOpen ? `short-share-${postId}` : undefined} className="button-target flex min-w-0 items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><ShareIcon /></button>
        </div>
      </footer>}
      <AnimatePresence>
        {commentsOpen && post && blocks && <motion.div data-short-comments-overlay className="absolute inset-0 z-20 flex flex-col justify-end" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeComments() } }}>
          <motion.button type="button" aria-label="Close comments and return to short" className="absolute inset-0 w-full bg-black/25 backdrop-blur-[2px]" onClick={closeComments} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }} />
          <motion.section id="short-read-comments" aria-label="Short comments" className="relative flex max-h-[72%] min-h-0 flex-col rounded-t-[16px] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.16)] sm:px-7" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] pb-2"><h3 className="text-[16px] font-semibold">Comments ({post.commentsCount || 0})</h3><button ref={commentsCloseRef} type="button" onClick={closeComments} aria-label="Close comments" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[24px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">×</button></div>
            <div data-short-comments-scroll className="min-h-0 overflow-y-auto overscroll-contain pb-4 pt-3"><CommentsSection postId={postId} initialCount={post.commentsCount || 0} compact collapsible expanded={commentsOpen} onExpandedChange={setCommentsOpen} hideHeading /></div>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
      </div>
    </section>
    {listPosition >= 0 && listCount > 1 && <div role="group" aria-label="Browse shorts" className="absolute left-[calc(100%+16px)] top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex">
      <button type="button" onClick={() => onNavigateList(-1)} disabled={listPosition === 0} aria-label="Previous short" className="button-target flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-float)] transition-colors hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><span aria-hidden="true" className="text-[20px] leading-none">↑</span></button>
      <button type="button" onClick={() => onNavigateList(1)} disabled={listPosition === listCount - 1} aria-label="Next short" className="button-target flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-float)] transition-colors hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><span aria-hidden="true" className="text-[20px] leading-none">↓</span></button>
    </div>}
    </div>
    {shareOpen && post && <ShareMenu anchorRef={shareTriggerRef} id={`short-share-${postId}`} label="Share short" contentName="Short" url={`${window.location.origin}/post/${post._id || postId}`} onClose={({ restoreFocus = false } = {}) => { setShareOpen(false); if (restoreFocus) requestAnimationFrame(() => shareTriggerRef.current?.focus()) }} />}
    {saveOpen && post && <AddToCollectionDialog postId={postId} title={post.title} isBookmarked={Boolean(post.isBookmarked)} saveMode returnFocusRef={saveTriggerRef} onClose={() => setSaveOpen(false)} />}
  </ModalLayer>
}
