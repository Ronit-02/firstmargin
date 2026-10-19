import retainRetryView from '@/shared/utils/retainRetryView'
import { AddToCollectionDialog } from '@/features/collection'
import ReportForm from '@/shared/components/ui/ReportForm'
import ReportModal, { reportTitle } from '@/shared/components/ui/ReportModal'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { BookmarkIcon, ShareIcon } from '@/shared/icons'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'
import Tag from '@/shared/components/ui/Tag'
import Divider from '@/shared/components/ui/Divider'
import Button from '@/shared/components/ui/Button'
import { PostDetailSkeleton } from '@/shared/components/ui/Skeleton'
import MissingResourceState from '@/shared/components/ui/MissingResourceState'
import isMissingResourceError from '@/shared/errors/isMissingResourceError'
import PostBody from './PostBody'
import CommentsSection from './CommentsSection'
import { AIStickyButtons, AccessPanel, SummaryPanel, ReadAloudPanel } from './AIPanel'
import useFetchPost from '../hooks/useFetchPost'
import usePostLike from '../hooks/usePostLike'
import AppreciationButton from '@/features/post/components/AppreciationButton'
import useReportPost from '../hooks/useReportPost'
import useReadingProgress from '../hooks/useProgressBar'
import usePersistReadingProgress from '../hooks/usePersistReadingProgress'
import useAuth from '@/features/auth/hooks/useAuth'
import { createInteractionEvent, recordInteractionEvents } from '@/features/discovery/api/events'
import useEntitlements from '@/features/membership/hooks/useEntitlements'
import useWriter from '@/features/user/hooks/useWriter'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import ShortReadModal from '@/features/discovery/components/ShortReadModal'
import PageFrame from '@/shared/components/layout/PageFrame'
import ImageBox from '@/shared/components/ui/ImageBox'
import { useEscapeKey } from '@/shared/hooks/useEscapeKey'
import AddToSeriesDialog, { SeriesActionIcon } from '@/features/discovery/components/AddToSeriesDialog'

const FlagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 21V4" />
    <path d="M5 5h11l-1.5 4L16 13H5" />
  </svg>
)

const parsePostBlocks = body => {
  try {
    const blocks = JSON.parse(body)
    return Array.isArray(blocks) ? blocks : null
  } catch {
    return null
  }
}

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useFetchPost(id)
  if (query.data?.format === 'short') {
    const blocks = parsePostBlocks(query.data.body)
    const close = () => window.history.state?.idx > 0 ? navigate(-1) : navigate('/shorts', { replace: true })
    return <PageFrame>{blocks && <PostMetadata post={query.data} blocks={blocks} />}<ShortReadModal key={id} postId={id} onClose={close} onNavigateAway={() => {}} onNavigate={nextId => navigate(`/post/${nextId}`, { replace: true })} /></PageFrame>
  }
  return <ArticlePage />
}

function ArticlePage() {
  const navigate  = useNavigate()
  const location = useLocation()
  const { id: postId } = useParams();
  const { loggedIn, signIn } = useAuth()
  const entitlements = useEntitlements(loggedIn)

  // UI State
  const [showSummary, setShowSummary] = useState(false)
  const [readAloud,   setReadAloud]   = useState(false)
  const [showShare,   setShowShare]   = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [showSeries, setShowSeries] = useState(false)
  const [showReport,  setShowReport]  = useState(false)
  const [shortReadId, setShortReadId] = useState(null)
  const [isWideScreen, setIsWideScreen] = useState(() => window.matchMedia('(min-width: 1280px)').matches)
  const hasSidePanel = showSummary || readAloud;

  // Hooks
  const { data: postData, isLoading: fetchPostIsLoading, isError, error, refetch } = retainRetryView(useFetchPost(postId));
  const authorPostsQuery = useWriter(postData?.author?.handle)
  const likeMutation = usePostLike(postId)
  const reportMutation = useReportPost(postId)
  const pageRef = useRef(null)
  const readingEndRef = useRef(null)
  const shareTriggerRef = useRef(null)
  const saveTriggerRef = useRef(null)
  const seriesTriggerRef = useRef(null)
  const summaryTriggerRef = useRef(null)
  const audioTriggerRef = useRef(null)
  const progress = useReadingProgress(pageRef, readingEndRef)
  usePersistReadingProgress(postId, progress, loggedIn)
  const recordedPostId = useRef(null)
  const recordedCompletion = useRef(false)
  const recordedDepths = useRef(new Set())
  const restoredProgress = useRef(false)

  useEffect(() => {
    const savedProgress = Number(location.state?.readingProgress)
    if (restoredProgress.current || !postData?._id || !Number.isFinite(savedProgress) || savedProgress <= 0) return
    const scroller = document.querySelector('[data-app-scroll="true"]')
    const end = readingEndRef.current
    if (!scroller || !end) return
    const restore = () => {
      const scrollTop = scroller.scrollTop
      const scrollerTop = scroller.getBoundingClientRect().top
      const endPosition = end.getBoundingClientRect().top - scrollerTop + scrollTop
      const total = endPosition - scroller.clientHeight
      if (total <= 0) return
      scroller.scrollTop = total * Math.min(100, savedProgress) / 100
      restoredProgress.current = true
    }
    const frame = requestAnimationFrame(restore)
    return () => cancelAnimationFrame(frame)
  }, [location.state, postData])

  const closeShareMenu = ({ restoreFocus = false } = {}) => {
    setShowShare(false)
    if (restoreFocus) requestAnimationFrame(() => shareTriggerRef.current?.focus())
  }

  // Page Effects
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const update = () => setIsWideScreen(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEscapeKey(() => {
    if (showShare) closeShareMenu({ restoreFocus: true })
  })

  useEffect(() => {
    if (!postData?._id || recordedPostId.current === postData._id) return
    recordedPostId.current = postData._id
    recordedCompletion.current = false
    recordedDepths.current = new Set()
    recordInteractionEvents([createInteractionEvent({
      eventType: 'open',
      postId: postData._id,
      writerId: postData.author?._id,
      surface: 'article',
    })]).catch(() => {})
  }, [postData])

  useEffect(() => {
    if (!postData?._id) return
    const milestone = [75, 50, 25].find(value => progress >= value && !recordedDepths.current.has(value))
    if (!milestone) return
    recordedDepths.current.add(milestone)
    recordInteractionEvents([createInteractionEvent({
      eventType: 'reading_depth',
      postId: postData._id,
      writerId: postData.author?._id,
      surface: 'article',
      metadata: { readingDepth: milestone },
    })]).catch(() => recordedDepths.current.delete(milestone))
  }, [postData, progress])

  useEffect(() => {
    if (!postData?._id || progress < 90 || recordedCompletion.current) return
    recordedCompletion.current = true
    recordInteractionEvents([createInteractionEvent({
      eventType: 'complete',
      postId: postData._id,
      writerId: postData.author?._id,
      surface: 'article',
      metadata: { readingDepth: Math.min(100, Math.round(progress)) },
    })]).catch(() => {})
  }, [postData, progress])

  // Action Handlers
  const handleBookmark = () => {
    if (!loggedIn) return signIn()
    setShowSave(true)
  }

  const handleLike = () => {
    if (!loggedIn) return signIn()
    likeMutation.mutate(!postData.isLiked)
  }

  const handleReportOpen = () => {
    if (!loggedIn) return signIn()
    reportMutation.reset()
    setShowReport(true)
  }

  // Conditional Rendering
  // Session restoration temporarily disables the reader-specific detail query.
  // Keep the existing skeleton visible until a post response is available so a
  // reload cannot dereference an absent response and blank the page.
  if (fetchPostIsLoading || (!postData && !isError)) return <PageFrame><PostDetailSkeleton as="div" className="!m-0 !max-w-[760px] !p-0" /></PageFrame>;
  if (isError && isMissingResourceError(error)) return <MissingResourceState eyebrow="Story unavailable" title="This story is no longer available" detail="It may have been removed, unpublished, or the link may be incorrect. Explore recent stories instead." recoveryTo="/" recoveryLabel="Explore stories" />;
  if (isError) return <PostErrorState onRetry={refetch} />;
  const postBlocks = parsePostBlocks(postData.body)
  if (!postBlocks) return <PostErrorState onRetry={() => navigate('/')} invalidContent />
  const capabilities = new Set(entitlements.data?.capabilities || [])
  const moreFromAuthor = (authorPostsQuery.data?.posts || []).filter(post => String(post.id) !== String(postId)).slice(0, 5)
  const morePosts = moreFromAuthor.filter(post => post.format !== 'short')
  const moreShorts = moreFromAuthor.filter(post => post.format === 'short')
  const articleText = [postData.title, ...postBlocks.filter(block => !['image', 'divider'].includes(block.type)).map(block => String(block.content || '').replace(/<[^>]*>/g, ' '))]
    .join('. ').replace(/\s+/g, ' ').trim()

  const openPremiumPanel = (setter, otherSetter) => {
    if (!loggedIn) return signIn()
    setter(value => !value)
    otherSetter(false)
  }

  const readingTools = <AIStickyButtons
    showSummary={showSummary} readAloud={readAloud}
    summaryRef={summaryTriggerRef} audioRef={audioTriggerRef}
    onSummary={() => openPremiumPanel(setShowSummary, setReadAloud)}
    onAudio={() => openPremiumPanel(setReadAloud, setShowSummary)}
  />
  const readingPanel = <>
    {showSummary && capabilities.has('article_summary') && <SummaryPanel postId={postId} />}
    {readAloud && capabilities.has('read_aloud') && <ReadAloudPanel text={articleText} />}
  </>

  return (
    <div ref={pageRef} className="relative bg-(--color-bg) text-(--color-text) min-h-screen">
      <PostMetadata post={postData} blocks={postBlocks} />

      {/* ── Reading progress bar (full width, below navbar) ── */}
      <div
        data-reading-progress="true"
        className="fixed left-0 right-0 top-14 z-[110] h-[3px]"
        aria-hidden="true"
        style={{ backgroundColor: 'var(--color-bg-alt)' }}
      >
        <div
          className="h-full"
          style={{ width: `${progress}%`, backgroundColor: 'var(--color-accent)' }}
        />
      </div>

      {/* ── Page body — LEFT aligned (matches sidebar layout) ── */}
      <PageFrame className="flex flex-col gap-8 xl:flex-row">

        {/* ── Article column ── */}
        <div className="min-w-0 w-full flex-1">

          {/* Tags */}
          {postData.tags?.length > 0 && (
            <div className="flex gap-1.5 mb-3.5 flex-wrap">
              {postData.tags.map(t => <Tag key={t} label={t} clickable />)}
            </div>
          )}

          {/* Hero image */}
          <ImageBox src={postData.coverImage} alt="" height="clamp(180px, 30vw, 320px)" radius="20px" placeholderLabel="Text-only story" style={{ marginBottom: '2rem' }} />

          {/* Title */}
          <h1 className="break-words font-bold text-(--color-text) leading-[1.3] tracking-[-0.5px] mb-5 text-[clamp(22px,4vw,32px)]"
            style={{ fontFamily: 'var(--font-display)' }}>
            {postData.title}
          </h1>

          {/* Author row + actions */}
          <div className="flex flex-col items-start justify-between mb-6 gap-5 sm:flex-row sm:items-center sm:flex-wrap sm:gap-6">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[200px]">
              <AuthorMeta author={postData.author} readTime={postData?.readTime || '5 mins'} date={postData.createdAt} size="md" stacked variant="article" />
            </div>

            <div role="group" aria-label="Story actions" className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
              
              <AppreciationButton isLiked={postData.isLiked} count={postData.likesCount} label={postData.isLiked ? 'Remove appreciation' : 'Appreciate this story'} disabled={likeMutation.isPending} onClick={handleLike} />

              <Button ref={saveTriggerRef} type="button" onClick={handleBookmark}
                aria-label={postData.isBookmarked ? 'Manage saved story' : 'Save this story'}
                aria-haspopup="dialog"
                aria-pressed={postData.isBookmarked}
                variant="action"
                leadingIcon={<BookmarkIcon filled={postData.isBookmarked} />}
                className="!min-h-11 !px-3 hover:opacity-80">
                {postData.isBookmarked ? 'Saved' : 'Save'}
              </Button>

              {postData.canAddToSeries && <Button ref={seriesTriggerRef} type="button" onClick={() => setShowSeries(true)} aria-label="Add this story to a series" aria-haspopup="dialog" variant="action" leadingIcon={<SeriesActionIcon />} className="!min-h-11 !px-3">Series</Button>}
              
              {/* Share */}
              <div className="relative">
                <Button ref={shareTriggerRef} type="button" onClick={e => { e.stopPropagation(); setShowShare(v => !v) }}
                  aria-label="Share this story"
                  aria-expanded={showShare}
                  aria-haspopup="dialog"
                  aria-controls={showShare ? 'article-share-menu' : undefined}
                  variant="action" leadingIcon={<ShareIcon />} className="!min-h-11 !px-3">
                  Share
                </Button>
                {showShare && <ShareMenu anchorRef={shareTriggerRef} onClose={closeShareMenu} id="article-share-menu" label="Share story" contentName="Story" url={`${window.location.origin}/post/${postId}`} />}
              </div>

              <Button
                type="button"
                onClick={handleReportOpen}
                aria-label={reportTitle(postData.format === 'short' ? 'short' : 'post')}
                aria-haspopup="dialog"
                aria-expanded={showReport}
                title={reportTitle(postData.format === 'short' ? 'short' : 'post')}
                variant="action"
                leadingIcon={<FlagIcon />}
                className="!min-h-11 !px-3 text-(--color-text-muted) hover:text-(--color-text-secondary)">
                Report
              </Button>
            </div>
            
          </div>

          {!isWideScreen && <div className="mb-6">
            {readingTools}
            {hasSidePanel && readingPanel}
          </div>}

          <Divider className="mb-6" />

          {postData.depthContext && <aside className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-(--color-border) bg-(--color-bg-alt) p-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-(--color-text-muted)">{postData.depthContext.deeper ? 'Go deeper' : 'Need the quick version?'}</p><p className="mt-1 text-[13px] font-semibold text-(--color-text)">{postData.depthContext.deeper?.title || postData.depthContext.quick?.title}</p></div>{postData.depthContext.deeper ? <Link to={`/post/${postData.depthContext.deeper.id}`} className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) px-[18px] py-2 text-[13px] font-medium whitespace-nowrap text-(--color-text) transition-all duration-150 hover:bg-(--color-bg-alt) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">Read full story →</Link> : <Button className="min-h-10 sm:min-h-0" variant="secondary" onClick={() => setShortReadId(postData.depthContext.quick.id)}>Read short →</Button>}</aside>}

          {likeMutation.isError && (
            <p role="alert" className="text-[12px] text-[var(--color-danger)] mb-4">
              We couldn't update that story action. Please try again.
            </p>
          )}

          {showReport && (
            <ReportModal title={reportTitle(postData.format === 'short' ? 'short' : 'post')} onClose={() => setShowReport(false)}>
              <ReportForm subject={postData.format === 'short' ? 'short' : 'post'} mutation={reportMutation} onClose={() => setShowReport(false)} />
            </ReportModal>
          )}

          {/* Body */}
          <article aria-label="Story body" className="w-full min-w-0">
            <PostBody body={postBlocks} />
          </article>

          {postData.seriesContext && <nav aria-label="Story series progression" className="mt-8 w-full min-w-0">
            <Link to={`/series/${postData.seriesContext.id}`} aria-label={`View series: ${postData.seriesContext.title}`} className="group button-target flex min-h-24 min-w-0 flex-col items-start justify-center gap-2 rounded-[14px] border border-(--color-border) bg-(--color-bg-alt) px-5 py-4 text-(--color-text) transition-colors hover:border-(--color-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="block w-full min-w-0 sm:flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-(--color-text-muted)">This story is part of a series{Number.isInteger(postData.seriesContext.position) && Number.isInteger(postData.seriesContext.total) ? ` · Part ${postData.seriesContext.position + 1} of ${postData.seriesContext.total}` : ''}</span><span data-series-next-title className="mt-1 block truncate text-[18px] font-semibold leading-snug" style={{ fontFamily: 'var(--font-display)' }}>{postData.seriesContext.title}</span></span><span data-series-next-action aria-hidden="true" className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-(--color-accent)">View series →</span></Link>
          </nav>}

          <Divider className="my-10" />

          <div ref={readingEndRef} />

          {/* Comments (renamed from Responses) */}
          <CommentsSection postId={postId} initialCount={postData.commentsCount || 0} />

          {morePosts.length > 0 && <section className="mt-14 w-full max-w-none" aria-labelledby="more-from-author-heading">
            <div className="mb-6">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">More to read</p>
              <h2 id="more-from-author-heading" className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>More from {postData.author?.username || 'this writer'}</h2>
            </div>
            <div className="grid w-full grid-cols-1 min-[540px]:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {morePosts.map(post => <DiscoveryPostCard key={post.id} post={post} variant="grid" />)}
            </div>
          </section>}
          {moreShorts.length > 0 && <section className="mt-14 w-full max-w-none" aria-labelledby="more-shorts-from-author-heading">
            <div className="mb-6">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Shorts</p>
              <h2 id="more-shorts-from-author-heading" className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Shorts from {postData.author?.username || 'this writer'}</h2>
            </div>
            <div className="card-grid card-grid--short gap-4">
              {moreShorts.map(post => <DiscoveryPostCard key={post.id} post={post} variant="grid" />)}
            </div>
          </section>}
        </div>

        {/* ── AI sticky buttons ── */}
        {isWideScreen && <div className="w-13 shrink-0">{readingTools}</div>}

        {/* ── Side AI panels ── */}
        {isWideScreen && hasSidePanel && (
          <div className="h-fit shrink-0 flex flex-col gap-3 sticky top-20 w-90">
            {readingPanel}
          </div>
        )}
      </PageFrame>
      {showSummary && !capabilities.has('article_summary') && <AccessPanel capability="article_summary" onClose={() => setShowSummary(false)} returnFocusRef={summaryTriggerRef} />}
      {readAloud && !capabilities.has('read_aloud') && <AccessPanel capability="read_aloud" onClose={() => setReadAloud(false)} returnFocusRef={audioTriggerRef} />}
      {showSave && <AddToCollectionDialog postId={postId} title={postData.title} isBookmarked={Boolean(postData.isBookmarked)} saveMode returnFocusRef={saveTriggerRef} onClose={() => setShowSave(false)} />}
      {showSeries && <AddToSeriesDialog postId={postId} title={postData.title} format="article" returnFocusRef={seriesTriggerRef} onClose={() => setShowSeries(false)} />}
      {shortReadId && <ShortReadModal postId={shortReadId} onClose={() => setShortReadId(null)} />}
    </div>
  )
}

function PostErrorState({ invalidContent = false, onRetry }) {
  const title = 'The story could not be loaded'
  const detail = invalidContent
    ? 'The published content is not in a readable format. Please return to discovery and try another story.'
    : 'Something went wrong while loading this story. You can try again or return to discovery.'

  return (
    <PageFrame>
      <div role="alert" className="max-w-[620px] border-y border-[var(--color-border)] py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Story</p>
        <h1 className="mt-3 text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.045em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        <p className="mt-4 text-[14px] leading-7 text-[var(--color-text-secondary)]">{detail}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {!invalidContent && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
          <Link to="/" className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-accent)] px-[18px] py-2 text-[13px] font-medium transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-inverted)' }}>Return home</Link>
        </div>
      </div>
    </PageFrame>
  )
}

function PostMetadata({ post, blocks }) {
  useEffect(() => {
    const previousTitle = document.title
    const description = blocks.filter(block => !['image', 'divider', 'code'].includes(block.type)).map(block => String(block.content || '')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    const canonicalUrl = `${window.location.origin}/post/${post._id}`
    document.title = `${post.title} · firstmargin`
    const ensureMeta = (selector, attributes) => {
      let node = document.head.querySelector(selector)
      if (!node) { node = document.createElement('meta'); node.dataset.inkRiderDynamic = 'true'; document.head.appendChild(node) }
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value))
      return node
    }
    ensureMeta('meta[name="description"]', { name: 'description', content: description })
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: post.title })
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' })
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })
    if (post.coverImage) ensureMeta('meta[property="og:image"]', { property: 'og:image', content: post.coverImage })
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.dataset.inkRiderDynamic = 'true'; document.head.appendChild(canonical) }
    canonical.href = canonicalUrl
    const structured = document.createElement('script')
    structured.type = 'application/ld+json'
    structured.dataset.inkRiderDynamic = 'true'
    structured.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description, image: post.coverImage || undefined, datePublished: post.createdAt, dateModified: post.updatedAt || post.createdAt, author: { '@type': 'Person', name: post.author?.username || 'firstmargin writer', url: post.author?.handle ? `${window.location.origin}/author/${post.author.handle}` : undefined }, mainEntityOfPage: canonicalUrl })
    document.head.appendChild(structured)
    return () => {
      document.title = previousTitle
      document.head.querySelectorAll('[data-ink-rider-dynamic="true"]').forEach(node => node.remove())
    }
  }, [post, blocks])
  return null
}
