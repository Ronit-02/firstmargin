import retainRetryView from '@/shared/utils/retainRetryView'
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- The tab container owns tab semantics. */
import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import useAuth from '@/features/auth/hooks/useAuth'
import Button from '@/shared/components/ui/Button'
import ButtonLink from '@/shared/components/ui/ButtonLink'
import FilterBar from '@/shared/components/ui/FilterBar'
import { ListSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import useEntitlements from '@/features/membership/hooks/useEntitlements'
import useManageMembership from '@/features/membership/hooks/useManageMembership'
import { openBillingPortal, startMembershipCheckout } from '@/features/membership/api/membership'
import { fetchMyPosts, fetchMyProfile, fetchWriterAnalytics } from '../../api/profile'
import roleLabel from '../../utils/roleLabel'
import { fetchDrafts } from '@/features/editor/api/drafts'
import DeleteDraftButton from '@/features/editor/components/DeleteDraftButton'
import FormatChooser from '@/features/editor/components/FormatChooser'
import { PenIcon } from '@/shared/icons'
import PageHeader from '@/shared/components/ui/PageHeader'
import PageFrame from '@/shared/components/layout/PageFrame'
import useToast from '@/shared/hooks/useToast'
import Avatar from '@/shared/components/ui/Avatar'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import CollectionCard from '@/features/collection/components/CollectionCard'
import SeriesCard from '@/features/discovery/components/SeriesCard'
import { useAuthorCollections } from '@/features/collection/hooks/useCollections'
import { useAuthorSeries } from '@/features/discovery/hooks/useShortSeries'
import PublishedWritingTabs from '../../components/PublishedWritingTabs'
import useWriter from '../../hooks/useWriter'
import SignInPrompt from '@/shared/components/ui/SignInPrompt'
import WritingStudioShortCard from '../../components/WritingStudioShortCard'
import WritingPostRow from '../../components/WritingPostRow'
import { useQuestionOpportunities } from '@/features/question/hooks/useQuestions'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import CreatorTools from '@/features/membership/components/CreatorTools'

const WRITING_TABS = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'updates', label: 'Updates' },
  { id: 'workshops', label: 'Workshops' },
  { id: 'requests', label: 'Requests' },
]

function AdvancedAnalyticsModal({ onClose, onJoin, joining }) {
  const closeRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeRef)
  return <ModalLayer onDismiss={onClose} aria-labelledby="advanced-analytics-title" className="flex items-center justify-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
      <ModalHeader title="Advanced analytics" titleId="advanced-analytics-title" closeLabel="Close advanced analytics" closeRef={closeRef} onClose={onClose} />
      <div className="p-5 sm:p-6"><p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">Become a member to see story opens, completed reads, completion rate, and performance for each story.</p><div className="mt-5 flex justify-end"><Button disabled={joining} aria-busy={joining} onClick={onJoin}>Become a member</Button></div></div>
    </section>
  </ModalLayer>
}


function ReaderSuggestions() {
  const opportunities = retainRetryView(useQuestionOpportunities())
  const questions = opportunities.data?.data?.slice(0, 3) || []
  return <section aria-label="Reader ideas">
    <p className="text-[13px] text-[var(--color-text-secondary)]">Questions ranked by topic fit and reader interest.</p>
    {opportunities.isPending ? <div className="mt-6" role="status" aria-label="Finding reader questions"><ListSkeleton count={3} role={undefined} /></div> : opportunities.isError ? <div role="alert" className="mt-6"><p className="text-[13px] text-[var(--color-text-muted)]">Reader questions could not be loaded.</p><Button className="mt-3" variant="secondary" onClick={() => opportunities.refetch()}>Try again</Button></div> : questions.length ? <div className="mt-5">{questions.map(question => <article key={question.id} className="border-b border-[var(--color-border)] py-5"><p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-info)]">{question.reason || 'Open question from readers'}</p><h3 className="mt-2 text-[17px] font-bold leading-[1.4] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}><Link to={`/explore/questions/${question.id}`} className="rounded-[4px] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">{question.text}</Link></h3>{question.context && <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{question.context}</p>}<p className="mt-3 text-[12px] text-[var(--color-text-muted)]">{question.upvotesCount || 0} {question.upvotesCount === 1 ? 'upvote' : 'upvotes'} · {question.followersCount || 0} following</p></article>)}</div> : <p className="mt-6 py-8 text-[13px] text-[var(--color-text-muted)]">No open reader questions right now.</p>}
  </section>
}

function StatCard({ label, value, sub }) {
  return (
    <div className="px-5 py-4 bg-[var(--color-bg-alt)] rounded-[14px] border border-[var(--color-border)]">
      <p className="font-bold text-[22px] text-[var(--color-text)] mb-0.5">{value}</p>
      <p className="text-[12px] text-[var(--color-text-secondary)]">{label}</p>
      {sub && <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{sub}</p>}
    </div>
  )
}

function PostRows({ posts = [], emptyMessage, manage = false, gridShorts = false }) {
  if (gridShorts) return <>
    {!posts.length && <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">{emptyMessage}</p>}
    {!!posts.length && <div className="card-grid card-grid--short gap-4">{posts.map(post => <WritingStudioShortCard key={post._id || post.id} post={post} />)}</div>}
  </>
  return <div>
    {!posts.length && <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">{emptyMessage}</p>}
    {posts.map(post => <WritingPostRow key={post._id || post.id} post={post} manage={manage} />)}
  </div>
}
function ProfileDataError({ message, onRetry }) {
  return <div role="alert"><p className="text-[13px] text-[var(--color-danger)]">{message}</p><Button className="mt-4" variant="secondary" onClick={onRetry}>Try again</Button></div>
}

export default function ProfilePage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const legacyTab = params.get('profileTab')
  const legacyParams = new URLSearchParams(params)
  legacyParams.delete('profileTab')
  const legacyPath = ['posts', 'shorts', 'drafts', 'analytics'].includes(legacyTab) ? '/studio' : ['bookmarks', 'history'].includes(legacyTab) ? '/saved' : null
  if (legacyPath === '/studio') legacyParams.set('writingTab', legacyTab)
  if (legacyTab === 'history') legacyParams.set('libraryTab', 'history')
  const legacyDestination = legacyPath ? `${legacyPath}${legacyParams.size ? `?${legacyParams}` : ''}${location.hash}` : null
  const isReady = useSelector(state => state.auth.isReady)
  const auth = useAuth()
  if (!isReady) return <PageFrame><p role="status" className="text-[13px] text-[var(--color-text-muted)]">Restoring your session…</p></PageFrame>
  if (!auth.loggedIn) return <PageFrame className="flex min-h-full flex-col !py-6">
    <SignInPrompt message="Sign in to view your profile." />
  </PageFrame>
  if (legacyDestination) return <Navigate to={legacyDestination} replace />
  return <MemberProfile />
}

export function MemberProfile({ writing = false }) {
  const [choosingFormat, setChoosingFormat] = useState(false)
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false)
  const [analyticsAsOf] = useState(() => Date.now())
  const location = useLocation()
  const TABS = writing ? WRITING_TABS : []
  const navigate = useNavigate()
  const { notify } = useToast()
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('writingTab')
  const tab = writing ? (requestedTab === 'creator' ? 'requests' : TABS.some(item => item.id === requestedTab) ? requestedTab : ['posts', 'shorts'].includes(requestedTab) ? 'published' : 'analytics') : 'overview'
  const writingFormat = params.get('writingFormat') === 'short' || (requestedTab === 'shorts' && !params.has('writingFormat')) ? 'short' : 'article'
  const draftFormat = params.get('draftFormat') === 'short' ? 'short' : 'article'
  const viewer = useSelector(state => state.auth.user)
  const role = useSelector(state => state.auth.role)
  const profile = retainRetryView(useQuery({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile, enabled: !writing }))
  const publishedWriting = retainRetryView(useWriter(!writing ? profile.data?.handle : undefined))
  const publishedFormat = ['short', 'collections', 'series'].includes(params.get('profileFormat')) ? params.get('profileFormat') : 'article'
  const publishedSort = ['oldest', 'popular'].includes(params.get('profileSort')) ? params.get('profileSort') : 'latest'
  const visiblePublishedPosts = (publishedWriting.data?.posts || []).filter(post => (post.format || 'article') === publishedFormat).sort((left, right) => {
    const dateOrder = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    if (publishedSort === 'popular') return (right.likesCount || 0) - (left.likesCount || 0) || dateOrder
    return publishedSort === 'oldest' ? -dateOrder : dateOrder
  })
  const profileId = profile.data?.id || profile.data?._id
  const publicCollections = retainRetryView(useAuthorCollections(profileId, 'latest', publishedFormat === 'collections'))
  const publicSeries = retainRetryView(useAuthorSeries(profileId, 'article', publishedFormat === 'series'))
  const publicShortSeries = retainRetryView(useAuthorSeries(profileId, 'short', publishedFormat === 'series'))
  const visiblePublishedCollections = publicCollections.data?.pages.flatMap(page => page.data) || []
  const visiblePublishedSeries = [...(publicSeries.data?.pages.flatMap(page => page.data) || []), ...(publicShortSeries.data?.pages.flatMap(page => page.data) || [])]
  const setPublishedFilter = (key, value, defaultValue) => {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    navigate({ search: next.size ? `?${next}` : '', hash: location.hash }, { preventScrollReset: true })
  }
  const posts = retainRetryView(useQuery({ queryKey: ['me', 'posts', viewer], queryFn: fetchMyPosts, enabled: writing && ['analytics', 'published'].includes(tab) }))
  const drafts = retainRetryView(useQuery({ queryKey: ['me', 'drafts'], queryFn: fetchDrafts, enabled: tab === 'drafts' }))
  const entitlements = useEntitlements(writing && tab === 'analytics', { fresh: true })
  const profileMembership = useEntitlements(!writing)
  const manageMembership = useManageMembership()
  const isMember = ['active', 'trialing'].includes(profileMembership.data?.membership?.status)
  const canManageMembership = isMember && role !== 'admin'
  const canViewAnalytics = !entitlements.isFetching && !entitlements.isError && entitlements.data?.capabilities?.includes('writer_analytics')
  const analytics = retainRetryView(useQuery({ queryKey: ['me', 'analytics'], queryFn: fetchWriterAnalytics, enabled: tab === 'analytics' && canViewAnalytics }))
  const publishedPosts = (posts.data || []).filter(post => (post.publicationStatus === 'published' || post.status === 'published') && (!post.publicAt || new Date(post.publicAt).getTime() <= analyticsAsOf))
  const billing = useMutation({
    mutationFn: () => entitlements.data?.membership?.status === 'active' ? openBillingPortal() : startMembershipCheckout(),
    onSuccess: data => { window.location.assign(data.portalUrl || data.checkoutUrl) },
    onError: () => notify('Billing is temporarily unavailable.', { tone: 'error' }),
  })

  const setTab = nextTab => {
    const next = new URLSearchParams(params)
    if (requestedTab === 'shorts' && !next.has('writingFormat')) next.set('writingFormat', 'short')
    if (nextTab === 'analytics') next.delete('writingTab')
    else next.set('writingTab', nextTab)
    setParams(next)
  }
  const setWritingFormat = (key, format) => {
    const next = new URLSearchParams(params)
    if (format === 'article') next.delete(key)
    else next.set(key, format)
    if (key === 'writingFormat' && ['posts', 'shorts'].includes(next.get('writingTab'))) next.delete('writingTab')
    setParams(next, { preventScrollReset: true })
  }
  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = TABS.findIndex(item => item.id === tab)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TABS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    const nextTab = TABS[nextIndex]
    setTab(nextTab.id)
    requestAnimationFrame(() => document.querySelectorAll('[role="tab"][aria-controls="writing-tabpanel"]')[nextIndex]?.focus())
  }


  if (writing && posts.isLoading) return <PageFrame><PageHeader eyebrow="Publishing" title="Studio" /><div role="status" aria-label="Loading stories"><ListSkeleton count={4} role={undefined} /></div></PageFrame>
  if (!writing && profile.isLoading) return <PageFrame><div role="status" aria-label="Loading profile"><div className="flex items-start gap-5"><Skeleton className="h-20 w-20 shrink-0 rounded-full" /><div className="flex-1"><Skeleton className="h-7 w-48" /><Skeleton className="mt-3 h-3 w-72" /><Skeleton className="mt-2 h-3 w-full max-w-xl" /></div></div><div className="mt-10 grid gap-[14px] sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-[14px] border border-[var(--color-border)] p-5"><Skeleton className="h-7 w-16" /><Skeleton className="mt-2 h-3 w-24" /></div>)}</div><div className="mt-10"><ListSkeleton count={4} role={undefined} /></div></div></PageFrame>
  if (!writing && profile.isError) return <PageFrame><div><p role="alert" className="text-[13px] text-[var(--color-danger)]">We couldn’t load your profile.</p><Button variant="secondary" className="mt-4" onClick={() => profile.refetch()} aria-busy={profile.isFetching} disabled={profile.isFetching}>Try again</Button></div></PageFrame>
  const me = profile.data || {}

  return (
    <PageFrame>
      {writing && <PageHeader eyebrow="Publishing" title="Studio" description="Manage writing, creator updates, workshops, requests, and analytics." actions={<div className="flex w-full flex-col gap-2 min-[380px]:w-auto min-[380px]:flex-row min-[380px]:flex-wrap sm:justify-end"><ButtonLink to="/opportunities" variant="secondary" className="justify-center whitespace-nowrap">Find reader demand</ButtonLink><button type="button" onClick={() => setChoosingFormat(true)} className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)] px-[18px] py-2 text-[13px] font-medium whitespace-nowrap text-[var(--color-text-inverted)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">Write a story</button></div>} />}
      {!writing && <PageHeader eyebrow="Your space" title="Profile" description="Manage your public identity and explore the writing you’ve shared." />}
      {!writing && <header className="flex gap-5 mb-8 items-start flex-wrap">
        <Avatar src={me.avatarUrl} name={me.displayName} size={80} />
        <div className="flex-1 min-w-[240px]">
          <>
              <h2 className="font-bold text-[24px] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{me.displayName}</h2>
              {me.handle && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">@{me.handle}</p>}
              {roleLabel(me.role) && <span className="mt-2 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">{roleLabel(me.role)}</span>}
              <p className="mt-3 max-w-2xl text-[13px] leading-[1.65] text-[var(--color-text-secondary)]">{me.bio || 'Add a short biography so readers know what you write about.'}</p>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Member since {new Date(me.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          </>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageMembership && <Button variant="secondary" disabled={manageMembership.isPending} aria-busy={manageMembership.isPending} onClick={() => manageMembership.mutate()}>Manage membership</Button>}
          <Button variant="secondary" className="h-11 w-11 !p-0" aria-label="Edit profile" title="Edit profile" onClick={() => navigate(`/profile/edit${params.size ? `?${params}` : ''}`)}><PenIcon /></Button>
        </div>
      </header>}

      {!writing && manageMembership.isError && <p role="alert" className="mb-5 text-[12px] text-[var(--color-danger)]">Membership management is unavailable. Please try again.</p>}


      {writing && <nav aria-label="Writing sections" className="mb-8 flex max-w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-[var(--color-border)]" role="tablist">
        {TABS.map(item => <button key={item.id} type="button" role="tab" aria-controls="writing-tabpanel" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setTab(item.id)} className={`button-target inline-flex min-h-11 shrink-0 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0 ${tab === item.id ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{item.label}</button>)}

      </nav>}

      <div id={writing ? "writing-tabpanel" : undefined} role={writing ? "tabpanel" : undefined} aria-label={`${TABS.find(item => item.id === tab)?.label || 'Overview'} content`}>
      {!writing && <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))' }}><StatCard label="Published writing" value={me.postCount} /><StatCard label="Followers" value={me.followersCount} /><StatCard label="Following" value={me.followingCount} /><StatCard label="Account type" value={me.writerStatus === 'writer' ? 'Writer' : 'Reader'} />{me.writerStatus === 'writer' && <StatCard label="Member requests" value={me.directRequestsEnabled ? 'On' : 'Off'} sub="Up to 3 per month" />}</div>}
      {!writing && <section className="pt-10" aria-labelledby="profile-posts-heading">
        <div className="mb-7 grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="mb-1 text-[12px] text-[var(--color-text-muted)]">Published by {me.displayName}</p><h2 id="profile-posts-heading" className="text-[24px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Your published writing</h2></div><div className="shrink-0 sm:justify-self-end"><ButtonLink to="/studio" variant="secondary">Edit in Studio</ButtonLink></div></div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><PublishedWritingTabs value={publishedFormat} onChange={value => setPublishedFilter('profileFormat', value, 'article')} controlsId="profile-writing-panel" includeCollections includeSeries />{publishedFormat !== 'collections' && publishedFormat !== 'series' && visiblePublishedPosts.length > 0 && <FilterBar label="Published writing" options={[]} sortOptions={[{ id: 'latest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }, { id: 'popular', label: 'Most appreciated' }]} sortValue={publishedSort} onSortChange={value => setPublishedFilter('profileSort', value, 'latest')} onReset={() => setPublishedFilter('profileSort', 'latest', 'latest')} />}</div>
        <div id="profile-writing-panel" role="tabpanel" aria-label={`${publishedFormat === 'short' ? 'Shorts' : publishedFormat === 'collections' ? 'Collections' : publishedFormat === 'series' ? 'Series' : 'Stories'} content`}>
        {publishedFormat === 'collections' ? publicCollections.isPending ? <ListSkeleton label="Loading public collections" /> : publicCollections.isError ? <ProfileDataError message="Public collections could not be loaded." onRetry={() => publicCollections.refetch()} /> : visiblePublishedCollections.length ? <div className="card-grid card-grid--collection gap-5">{visiblePublishedCollections.map(collection => <CollectionCard key={collection.id} collection={collection} />)}</div> : <div className="border-y border-[var(--color-border)] py-14"><p className="text-[15px] text-[var(--color-text-secondary)]">No public collections yet.</p></div>
          : publishedFormat === 'series' ? publicSeries.isPending || publicShortSeries.isPending ? <ListSkeleton label="Loading public series" /> : publicSeries.isError || publicShortSeries.isError ? <ProfileDataError message="Public series could not be loaded." onRetry={() => { publicSeries.refetch(); publicShortSeries.refetch() }} /> : visiblePublishedSeries.length ? <div className="card-grid card-grid--series gap-4">{visiblePublishedSeries.map(series => <SeriesCard key={series.id} series={series} />)}</div> : <div className="border-y border-[var(--color-border)] py-14"><p className="text-[15px] text-[var(--color-text-secondary)]">No public series yet.</p></div>
          : publishedWriting.isLoading ? <ListSkeleton label="Loading published writing" />
          : publishedWriting.isError ? <ProfileDataError message="Published writing could not be loaded." onRetry={() => publishedWriting.refetch()} />
          : visiblePublishedPosts.length ? <div className={`${publishedFormat === 'short' ? 'card-grid card-grid--short' : 'grid grid-cols-1 min-[540px]:grid-cols-2 lg:grid-cols-3'} gap-x-6 gap-y-10`}>{visiblePublishedPosts.map(post => <DiscoveryPostCard key={post.id} post={post} variant="grid" />)}</div>
          : <div className="border-y border-[var(--color-border)] py-14"><p className="text-[15px] text-[var(--color-text-secondary)]">{publishedFormat === 'short' ? 'No published shorts yet.' : 'No published stories yet.'}</p></div>}
        </div>
      </section>}
      {writing && tab === 'published' && <div className="mb-6"><PublishedWritingTabs value={writingFormat} onChange={value => setWritingFormat('writingFormat', value)} controlsId="studio-published-panel" firstLabel="Stories" ariaLabel="Published categories" /></div>}
      {writing && tab === 'published' && <div id="studio-published-panel" role="tabpanel" aria-label={`${writingFormat === 'short' ? 'Shorts' : 'Stories'} content`}>
      {posts.isError ? <ProfileDataError message="Published stories could not be loaded." onRetry={() => posts.refetch()} /> : <PostRows posts={(posts.data || []).filter(post => (post.format || 'article') === writingFormat)} manage gridShorts={writingFormat === 'short'} emptyMessage={`You haven’t published any ${writingFormat === 'short' ? 'shorts' : 'stories'} yet.`} />}</div>}
      {writing && tab === 'drafts' && <div className="mb-6"><PublishedWritingTabs value={draftFormat} onChange={value => setWritingFormat('draftFormat', value)} controlsId="studio-drafts-panel" firstLabel="Stories" ariaLabel="Draft categories" /></div>}
      {tab === 'drafts' && <div id={writing ? 'studio-drafts-panel' : undefined} role={writing ? 'tabpanel' : undefined} aria-label={writing ? `${draftFormat === 'short' ? 'Shorts' : 'Stories'} drafts` : undefined}>{drafts.isLoading ? <div role="status" aria-label="Loading drafts"><ListSkeleton count={4} role={undefined} /></div> : drafts.isError ? <ProfileDataError message="Drafts could not be loaded." onRetry={() => drafts.refetch()} /> : (writing ? drafts.data?.filter(draft => (draft.format || 'article') === draftFormat) : drafts.data)?.length ? <div>{(writing ? drafts.data.filter(draft => (draft.format || 'article') === draftFormat) : drafts.data).map(draft => <div key={draft._id} className="flex min-w-0 items-center gap-3 border-b border-[var(--color-border)] py-7 sm:gap-5 sm:py-8"><div className="min-w-0 flex-1"><p className="font-semibold text-[16px] leading-[1.4] text-[var(--color-text)] [overflow-wrap:anywhere] sm:text-[18px]">{draft.title || 'Untitled draft'}</p><p className="mt-2 text-[12px] leading-5 text-[var(--color-text-muted)]">{draft.format === 'short' ? 'Short' : 'Story'} · Saved {new Date(draft.updatedAt).toLocaleString()}</p></div><div className="flex shrink-0 items-center gap-1 sm:gap-2"><Link to={`/studio?draft=${draft._id}`} aria-label={`Continue writing: ${draft.title || 'Untitled draft'}`} title="Continue writing" className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[var(--color-accent)] hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus:ring-[var(--color-focus)]"><PenIcon /></Link><DeleteDraftButton draft={draft} /></div></div>)}</div> : <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">{writing ? `No ${draftFormat === 'short' ? 'short' : 'story'} drafts yet.` : 'Your autosaved drafts will appear here.'}</p>}</div>}
      {tab === 'analytics' && <div>{posts.isError ? <ProfileDataError message="Basic analytics could not be loaded." onRetry={() => posts.refetch()} /> : <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))' }}><StatCard label="Published stories" value={publishedPosts.length} /><StatCard label="Reader appreciations" value={publishedPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0)} /><StatCard label="Comments" value={publishedPosts.reduce((sum, post) => sum + (post.commentsCount || 0), 0)} /></div>}
        {entitlements.isError && <div className="mt-6"><ProfileDataError message="Membership status could not be checked." onRetry={() => entitlements.refetch()} /></div>}
        {!canViewAnalytics && !entitlements.isFetching && !entitlements.isError && !entitlements.isPending && <div className="mt-6"><Button variant="secondary" onClick={() => setShowAdvancedAnalytics(true)}>View more analytics</Button></div>}
        {entitlements.isError && <div className="mt-4"><ProfileDataError message="Analytics access could not be loaded." onRetry={() => entitlements.refetch()} /></div>}
        {canViewAnalytics && (analytics.isLoading ? <div role="status" aria-label="Loading writer analytics" className="mt-7"><ListSkeleton count={5} role={undefined} /></div> : analytics.isError ? <div className="mt-7"><ProfileDataError message="Analytics could not be loaded." onRetry={() => analytics.refetch()} /></div> : analytics.data && <section className="mt-7">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">Writing performance</h2>
          {analytics.data.posts.map(post => <div key={post.id} className="border-t border-[var(--color-border)] py-5 sm:py-6">
            <Link to={`/post/${post.id}`} className="block max-w-3xl break-words text-[14px] font-semibold leading-5 text-[var(--color-text)] hover:text-[var(--color-accent)]">{post.title}</Link>
            <dl className="mt-4 grid max-w-[480px] grid-cols-3 gap-2 sm:gap-5">
              <div className="min-w-0"><dt className="text-[11px] text-[var(--color-text-muted)]">Opens</dt><dd className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{post.opens}</dd></div>
              <div className="min-w-0"><dt className="text-[11px] text-[var(--color-text-muted)]">Completed</dt><dd className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{post.completions}</dd></div>
              <div className="min-w-0"><dt className="text-[11px] text-[var(--color-text-muted)]">Appreciations</dt><dd className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{post.likes}</dd></div>
            </dl>
          </div>)}
        </section>)}
      </div>}
      </div>
      {writing && tab === 'ideas' && <ReaderSuggestions />}
      {writing && ['updates', 'workshops', 'requests'].includes(tab) && <CreatorTools tab={tab} />}
      {writing && billing.isError && <p role="alert" className="mt-4 text-[12px] text-[var(--color-danger)]">Billing is temporarily unavailable.</p>}
      {writing && choosingFormat && <FormatChooser loggedIn={Boolean(viewer)} onClose={() => setChoosingFormat(false)} />}
      {writing && showAdvancedAnalytics && <AdvancedAnalyticsModal onClose={() => setShowAdvancedAnalytics(false)} onJoin={() => billing.mutate()} joining={billing.isPending} />}
    </PageFrame>
  )
}
