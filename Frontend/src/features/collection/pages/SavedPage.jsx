import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import { useSelector } from 'react-redux'
import { useState } from 'react'
import retainRetryView from '@/shared/utils/retainRetryView'
import ReadingHistoryPage from '@/features/discovery/pages/ReadingHistory'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageFrame from '@/shared/components/layout/PageFrame'
import PageHeader from '@/shared/components/ui/PageHeader'
import Pill from '@/shared/components/ui/Pill'
import Button from '@/shared/components/ui/Button'
import FilterBar from '@/shared/components/ui/FilterBar'
import { availableFilterOptions } from '@/shared/utils/availableFilterOptions'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import SeriesCard from '@/features/discovery/components/SeriesCard'
import CreateSeriesModal from '@/features/discovery/components/CreateSeriesModal'
import { useOwnedSeries, useSavedSeries } from '@/features/discovery/hooks/useShortSeries'
import CollectionCard from '../components/CollectionCard'
import CreateCollectionModal from '../components/CreateCollectionModal'
import { PostCardSkeleton, ShortCardSkeleton } from '@/shared/components/ui/Skeleton'
import { fetchBookmarks } from '@/features/user/api/profile'
import { useCollections, useSavedCollections } from '../hooks/useCollections'

const getExcerpt = body => {
  try {
    const blocks = JSON.parse(body)
    return blocks.filter(block => !['image', 'divider'].includes(block?.type)).map(block => String(block.content || '')).join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
  } catch {
    return ''
  }
}

const toStoryPost = post => ({
  id: post._id || post.id,
  title: post.title,
  format: post.format,
  image: post.coverImage || post.image || null,
  excerpt: getExcerpt(post.body),
  tags: post.tags || [],
  likesCount: post.likesCount || 0,
  commentsCount: post.commentsCount || 0,
  isLiked: Boolean(post.isLiked),
  isBookmarked: post.isBookmarked ?? true,
  createdAt: post.createdAt,
  readTime: post.readTime || (post.format === 'short' ? 'Short' : 'Story'),
  author: {
    id: post.author?._id || post.author?.id || null,
    username: post.author?.username || post.author?.displayName || 'firstmargin writer',
    picture: post.author?.picture || post.author?.avatarUrl || null,
    handle: post.author?.handle || null,
  },
})

function SavedStoryList({ posts, shorts = false }) {
  if (!posts.length) return <p className="py-16 text-center text-[13px] text-[var(--color-text-muted)]">{shorts ? 'Shorts you save will appear here.' : 'Stories you save will appear here.'}</p>
  return <div className={shorts ? 'card-grid card-grid--short gap-4' : undefined}>{posts.map(post => <DiscoveryPostCard key={post._id || post.id} post={toStoryPost(post)} variant={shorts ? 'grid' : undefined} />)}</div>
}

function SavedContent() {
  const viewer = useSelector(state => state.auth.user)
  const [params, setParams] = useSearchParams()
  const section = ['stories', 'shorts', 'collections', 'series'].includes(params.get('savedSection')) ? params.get('savedSection') : params.get('savedFormat') === 'short' ? 'shorts' : 'stories'
  const sections = ['stories', 'shorts', 'collections', 'series']
  const sort = ['latest', 'popular'].includes(params.get('savedSort')) ? params.get('savedSort') : 'latest'
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (key === 'savedSection') next.delete('savedFormat')
      if (value === defaultValue) next.delete(key)
      else next.set(key, value)
      return next
    })
  }
  const handleSectionKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = sections.indexOf(section)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? sections.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length
    const nextSection = sections[nextIndex]
    updateFilter('savedSection', nextSection, 'stories')
    requestAnimationFrame(() => document.querySelectorAll('[role="tab"][aria-controls="saved-tabpanel"]')[nextIndex]?.focus())
  }
  const stories = retainRetryView(useQuery({ queryKey: ['me', 'bookmarks', viewer], queryFn: fetchBookmarks }))
  const savedStories = (stories.data || []).filter(post => (post.format || 'article') === (section === 'shorts' ? 'short' : 'article'))
  if (sort === 'popular') savedStories.sort((left, right) => (right.likesCount || 0) - (left.likesCount || 0))
  const resetFilters = () => setParams(current => {
    const next = new URLSearchParams(current)
    next.delete('savedSort')
    if (section === 'shorts') next.set('savedSection', 'shorts')
    next.delete('savedFormat')
    return next
  })

  return <>
    <div className="mb-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Saved library sections">
        <Pill label="Stories" role="tab" ariaControls="saved-tabpanel" tabIndex={section === 'stories' ? 0 : -1} active={section === 'stories'} onKeyDown={handleSectionKeyDown} onClick={() => updateFilter('savedSection', 'stories', 'stories')} />
        <Pill label="Shorts" role="tab" ariaControls="saved-tabpanel" tabIndex={section === 'shorts' ? 0 : -1} active={section === 'shorts'} onKeyDown={handleSectionKeyDown} onClick={() => updateFilter('savedSection', 'shorts', 'stories')} />
        <Pill label="Collections" role="tab" ariaControls="saved-tabpanel" tabIndex={section === 'collections' ? 0 : -1} active={section === 'collections'} onKeyDown={handleSectionKeyDown} onClick={() => updateFilter('savedSection', 'collections', 'stories')} />
        <Pill label="Series" role="tab" ariaControls="saved-tabpanel" tabIndex={section === 'series' ? 0 : -1} active={section === 'series'} onKeyDown={handleSectionKeyDown} onClick={() => updateFilter('savedSection', 'series', 'stories')} />
      </div>
      {section !== 'collections' && section !== 'series' && savedStories.length > 0 && <FilterBar label="Saved reads" options={[]} sortOptions={[{ id: 'latest', label: 'Latest saved' }, { id: 'popular', label: 'Most appreciated' }]} sortValue={sort} onSortChange={value => updateFilter('savedSort', value, 'latest')} onReset={resetFilters} />}
    </div>
    <div id="saved-tabpanel" role="tabpanel" aria-label={`${section[0].toUpperCase()}${section.slice(1)} content`}>
      {section === 'collections' ? <SavedCollections /> : section === 'series' ? <SavedSeries /> : <section aria-label={section === 'shorts' ? 'Saved shorts' : 'Saved stories'}>{stories.isPending ? <div role="status" aria-label={section === 'shorts' ? 'Loading saved shorts' : 'Loading saved stories'} className={section === 'shorts' ? 'card-grid card-grid--short gap-4' : 'space-y-4'}>{Array.from({ length: 3 }, (_, index) => section === 'shorts' ? <ShortCardSkeleton key={index} /> : <PostCardSkeleton key={index} compact />)}</div> : stories.isError ? <div className="py-12 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Saved stories could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => stories.refetch()} aria-busy={stories.isFetching} disabled={stories.isFetching}>Try again</Button></div> : <SavedStoryList posts={savedStories} shorts={section === 'shorts'} />}</section>}
    </div>
  </>
}

function SavedCollections() {
  const query = retainRetryView(useSavedCollections('latest'))
  const items = query.data?.pages.flatMap(page => page.data) || []
  return <section className="mt-10" aria-label="Saved collections">{query.isPending ? <div role="status" className="card-grid card-grid--collection gap-5"><PostCardSkeleton compact /><PostCardSkeleton compact /></div> : query.isError ? <div className="py-8 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Saved collections could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div> : items.length ? <div className="card-grid card-grid--collection gap-5">{items.map(item => <CollectionCard key={item.id} collection={item} />)}</div> : <p className="py-8 text-[13px] text-[var(--color-text-muted)]">Collections you save will appear here.</p>}<InfiniteScrollSentinel query={query} className="pt-7" /></section>
}

function SavedSeries() {
  const stories = retainRetryView(useSavedSeries('article'))
  const shorts = retainRetryView(useSavedSeries('short'))
  const items = [...(stories.data?.pages.flatMap(page => page.data) || []), ...(shorts.data?.pages.flatMap(page => page.data) || [])]
  const retry = () => { stories.refetch(); shorts.refetch() }
  return <section className="mt-10" aria-label="Saved series">{stories.isPending || shorts.isPending ? <div role="status" className="card-grid card-grid--series gap-4"><PostCardSkeleton compact /><PostCardSkeleton compact /></div> : stories.isError || shorts.isError ? <div className="py-8 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Saved series could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={retry}>Try again</Button></div> : items.length ? <div className="card-grid card-grid--series gap-4">{items.map(item => <SeriesCard key={item.id} series={item} />)}</div> : <p className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">Series you save will appear here.</p>}</section>
}

function LibraryCollections() {
  const [params, setParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const section = params.get('collectionSection') === 'saved' ? 'saved' : 'mine'
  const sort = ['latest', 'popular'].includes(params.get('collectionSort')) ? params.get('collectionSort') : 'latest'
  const mine = retainRetryView(useCollections(true, sort))
  const saved = retainRetryView(useSavedCollections(sort))
  const source = (section === 'mine' ? mine : saved).data?.pages.flatMap(page => page.data) || []
  const visibilityOptions = availableFilterOptions([{ id: 'all', label: 'All collections' }, { id: 'public', label: 'Public' }, { id: 'unlisted', label: 'Unlisted' }, { id: 'private', label: 'Private' }], source, item => [item.visibility], params.get('collectionVisibility'), (section === 'mine' ? mine : saved).hasNextPage)
  const visibility = visibilityOptions.some(option => option.id === params.get('collectionVisibility')) ? params.get('collectionVisibility') : 'all'
  const owned = (mine.data?.pages.flatMap(page => page.data) || []).filter(item => visibility === 'all' || item.visibility === visibility)
  const savedItems = (saved.data?.pages.flatMap(page => page.data) || []).filter(item => visibility === 'all' || item.visibility === visibility)
  const update = (key, value, defaultValue) => setParams(current => {
    const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    return next
  })
  const list = (query, items, label, empty) => <section className="mb-10" aria-label={label}>
    {query.isPending ? <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className="card-grid card-grid--collection gap-5"><PostCardSkeleton compact /><PostCardSkeleton compact /></div>
      : query.isError ? <div className="py-8 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">{label} could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>
        : items.length ? <div className="card-grid card-grid--collection gap-5">{items.map(item => <CollectionCard key={item.id} collection={item} />)}</div>
          : <p className="py-8 text-[13px] text-[var(--color-text-muted)]">{empty}</p>}
    {!query.isPending && !query.isError && <InfiniteScrollSentinel query={query} className="pt-7" />}
  </section>
  return <>
    <div className="mb-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <Button aria-label="Add collection" onClick={() => setShowCreate(true)}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Add</Button>
        {source.length > 0 && <FilterBar label="Collections" options={visibilityOptions.length > 2 || visibility !== 'all' ? visibilityOptions : []} value={visibility} onChange={value => update('collectionVisibility', value, 'all')} sortOptions={[{ id: 'latest', label: 'Newest collections' }, { id: 'popular', label: 'Most saved' }]} sortValue={sort} onSortChange={value => update('collectionSort', value, 'latest')} onReset={() => setParams(current => { const next = new URLSearchParams(current); next.delete('collectionVisibility'); next.delete('collectionSort'); return next })} />}
      </div>
    </div>
    <div id="library-collections-panel" role="tabpanel" aria-label={section === 'mine' ? 'My collections content' : 'Saved collections content'}>
      {section === 'mine' ? list(mine, owned, 'My collections', 'Collections you create will appear here.') : list(saved, savedItems, 'Saved collections', 'Collections you save will appear here.')}
    </div>
    {showCreate && <CreateCollectionModal onClose={() => setShowCreate(false)} />}
  </>
}

function LibrarySeries() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const type = params.get('seriesType') === 'short' ? 'short' : 'article'
  const sort = ['latest', 'title', 'parts'].includes(params.get('seriesSort')) ? params.get('seriesSort') : 'latest'
  const query = retainRetryView(useOwnedSeries(type))
  const items = query.data?.pages.flatMap(page => page.data) || []
  const sortedItems = [...items].sort((left, right) => sort === 'title' ? left.title.localeCompare(right.title) : sort === 'parts' ? (right.entriesCount || 0) - (left.entriesCount || 0) : new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
  const setType = nextType => setParams(current => {
    const next = new URLSearchParams(current)
    if (nextType === 'article') next.delete('seriesType')
    else next.set('seriesType', nextType)
    return next
  })
  const setSort = value => setParams(current => { const next = new URLSearchParams(current); if (value === 'latest') next.delete('seriesSort'); else next.set('seriesSort', value); return next })
  return <section aria-label="My series">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div role="tablist" aria-label="Series type" className="flex gap-2">
        {['article', 'short'].map(item => <Pill key={item} label={item === 'article' ? 'Stories' : 'Shorts'} role="tab" ariaControls="library-series-panel" tabIndex={type === item ? 0 : -1} active={type === item} onClick={() => setType(item)} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 'article' : event.key === 'End' ? 'short' : type === 'article' ? 'short' : 'article'; setType(next); requestAnimationFrame(() => document.querySelector(`[role="tab"][aria-controls="library-series-panel"][aria-selected="true"]`)?.focus()) }} />)}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button aria-label="Add series" onClick={() => setShowCreate(true)}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Add</Button>
        {items.length > 0 && <FilterBar label="Series" options={[]} sortOptions={[{ id: 'latest', label: 'Newest' }, { id: 'title', label: 'Title A–Z' }, { id: 'parts', label: 'Most parts' }]} sortValue={sort} onSortChange={setSort} onReset={() => setSort('latest')} />}
      </div>
    </div>
    <div id="library-series-panel" role="tabpanel" aria-label={`My ${type === 'short' ? 'short' : 'story'} series`}>
      {query.isPending && <div role="status" aria-label="Loading my series"><PostCardSkeleton compact /><PostCardSkeleton compact /></div>}
      {query.isError && <div className="py-8 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Your series could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>}
      {!query.isPending && !query.isError && (sortedItems.length ? <div className="card-grid card-grid--series gap-4">{sortedItems.map(item => <SeriesCard key={item.id} series={item} />)}</div> : <p className="py-8 text-[13px] text-[var(--color-text-muted)]">Series you create will appear here.</p>)}
      <InfiniteScrollSentinel query={query} className="pt-7" />
    </div>
    {showCreate && <CreateSeriesModal onClose={() => setShowCreate(false)} onCreated={id => navigate(`/series/${id}`)} />}
  </section>
}

export default function SavedPage() {
  const [params, setParams] = useSearchParams()
  const tab = ['saved', 'history', 'collections', 'series'].includes(params.get('libraryTab')) ? params.get('libraryTab') : 'saved'
  const tabs = ['saved', 'history', 'collections', 'series']
  const setTab = nextTab => {
    const next = new URLSearchParams(params)
    if (next.get('savedSection') === 'collections') next.delete('savedSection')
    if (nextTab === 'saved') next.delete('libraryTab')
    else next.set('libraryTab', nextTab)
    setParams(next)
  }
  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setTab(tabs[index])
    requestAnimationFrame(() => document.querySelectorAll('[role="tab"][aria-controls="library-tabpanel"]')[index]?.focus())
  }
  return <PageFrame>
    <PageHeader eyebrow="Reading" title="Library" description="Find saved stories, collections, and your series, or revisit past reads." />
    <div role="tablist" aria-label="Library sections" className="mb-8 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-[var(--color-border)]">
      {tabs.map(item => <button key={item} type="button" role="tab" aria-controls="library-tabpanel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={handleTabKeyDown} className={`button-target inline-flex min-h-11 shrink-0 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0 ${tab === item ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{item === 'saved' ? 'Saved' : item === 'history' ? 'History' : item === 'series' ? 'My series' : 'My collections'}</button>)}
    </div>
    <div id="library-tabpanel" role="tabpanel" aria-label={tab === 'saved' ? 'Saved content' : tab === 'history' ? 'History content' : tab === 'series' ? 'Series content' : 'Collections content'}>
      {tab === 'saved' ? <SavedContent /> : tab === 'history' ? <ReadingHistoryPage embedded /> : tab === 'series' ? <LibrarySeries /> : <LibraryCollections />}
    </div>
  </PageFrame>
}
