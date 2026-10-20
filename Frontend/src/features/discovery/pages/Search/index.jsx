import Select from '@/shared/components/ui/Select'
import PageFrame from '@/shared/components/layout/PageFrame'
import retainRetryView from '@/shared/utils/retainRetryView'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Avatar from '@/shared/components/ui/Avatar'
import FilterPopover from '@/shared/components/ui/FilterPopover'
import DiscoveryPostCard from '../../components/DiscoveryPostCard'
import ShortCard from '../../components/ShortCard'
import ShortReadModal from '../../components/ShortReadModal'
import useDiscoverySearch from '../../hooks/useDiscoverySearch'
import { ListSkeleton, PostFeedSkeleton } from '@/shared/components/ui/Skeleton'
import { QuestionCard } from '../Explore/QuestionsTab'

const TABS = [
  { id: 'posts', label: 'Stories' },
  { id: 'writers', label: 'Writers' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'questions', label: 'Questions' },
]

const TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'travel', label: 'Travel' },
  { id: 'ai', label: 'AI' },
  { id: 'science', label: 'Science' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'career', label: 'Career Education' },
]
const TOPIC_TAGS = {
  travel: ['travel'], ai: ['ai', 'artificial-intelligence', 'technology'], science: ['science'],
  entrepreneurship: ['entrepreneurship', 'business', 'finance'], lifestyle: ['lifestyle', 'wellness', 'food'],
  career: ['career', 'education', 'essays'],
}

const TIME_RANGES = [
  { id: 'any', label: 'Any time' },
  { id: 'day', label: 'Past 24 hours' },
  { id: 'week', label: 'Past week' },
  { id: 'month', label: 'Past month' },
  { id: 'year', label: 'Past year' },
]

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Most relevant' },
  { id: 'latest', label: 'Latest' },
]

function SearchState({ title, detail, onRetry, isError = false, busy = false }) {
  return (
    <div role={isError ? 'alert' : undefined} className="py-16 text-center border-y border-[var(--color-border)]">
      <h2 className="text-[17px] font-semibold text-[var(--color-text)]">{title}</h2>
      <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{detail}</p>
      {onRetry && <button type="button" onClick={onRetry} disabled={busy} aria-busy={busy} className="button-target mt-5 inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverted)] text-[12px] font-semibold sm:min-h-0">Try again</button>}
    </div>
  )
}

function WriterResult({ writer }) {
  const writerPath = `/author/${writer.handle}`
  return (
    <article className="flex flex-wrap items-start gap-4 py-6 border-b border-[var(--color-border)]">
      <Link to={writerPath} aria-label={`View ${writer.displayName}'s profile`} className="shrink-0 rounded-full">
        <Avatar src={writer.avatarUrl} name={writer.displayName} size={52} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={writerPath} className="text-left">
          <h2 className="text-[17px] font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]">{writer.displayName}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">@{writer.handle} · {writer.followersCount} followers</p>
        </Link>
        {writer.bio && <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)] line-clamp-2">{writer.bio}</p>}
      </div>
      <Link to={writerPath} className="button-target flex min-h-10 w-full shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[12px] font-semibold text-[var(--color-text)] sm:ml-auto sm:w-auto sm:min-h-0">View profile</Link>
    </article>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const [shortReadId, setShortReadId] = useState(null)
  const requestedTab = params.get('type')
  const activeTab = TABS.some(tab => tab.id === requestedTab) ? requestedTab : 'posts'
  const browse = !query.trim()
  const baseline = retainRetryView(useDiscoverySearch(query, activeTab))
  const availableItems = baseline.data?.data?.[activeTab] || []
  const availableTags = new Set(availableItems.flatMap(item => item.tags || []).map(tag => tag.toLowerCase()))
  const topicOptions = activeTab === 'writers' || availableItems.length < 2 ? [] : TOPICS.filter(option => option.id === 'all' || (TOPIC_TAGS[option.id]?.some(tag => availableTags.has(tag)) && availableItems.some(item => !(item.tags || []).some(tag => TOPIC_TAGS[option.id].includes(tag.toLowerCase())))))
  const topic = topicOptions.some(option => option.id === params.get('topic')) ? params.get('topic') : 'all'
  const dates = availableItems.map(item => new Date(item.createdAt).getTime()).filter(Number.isFinite)
  const timeOptions = activeTab === 'writers' || dates.length < 2 ? [] : TIME_RANGES.filter(option => option.id === 'any' || (dates.some(date => date >= Date.now() - ({ day: 1, week: 7, month: 30, year: 365 }[option.id] * 86400000)) && dates.some(date => date < Date.now() - ({ day: 1, week: 7, month: 30, year: 365 }[option.id] * 86400000))))
  const time = timeOptions.some(option => option.id === params.get('time')) ? params.get('time') : 'any'
  const sortOptions = activeTab !== 'writers' && availableItems.length > 1 ? SORT_OPTIONS.map(option => option.id === 'relevance' && browse ? { ...option, label: 'Most popular' } : option) : []
  const sort = sortOptions.some(option => option.id === params.get('sort')) ? params.get('sort') : 'relevance'
  const result = retainRetryView(useDiscoverySearch(query, activeTab, { topic, time, sort }))
  const items = result.data?.data?.[activeTab] || []
  const resultTypes = { posts: ['story', 'stories'], writers: ['writer', 'writers'], shorts: ['short', 'shorts'], questions: ['question', 'questions'] }[activeTab]

  const setActiveTab = nextTab => {
    const next = new URLSearchParams(params)
    if (nextTab === 'posts') next.delete('type')
    else next.set('type', nextTab)
    setParams(next)
  }

  const updateFilter = (key, value, defaultValue) => {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const activeFilterCount = [topic !== 'all', time !== 'any', sort !== 'relevance'].filter(Boolean).length
  const clearFilters = () => {
    const next = new URLSearchParams(params)
    next.delete('topic')
    next.delete('time')
    next.delete('sort')
    setParams(next, { replace: true })
  }

  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = TABS.findIndex(tab => tab.id === activeTab)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TABS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    const nextTab = TABS[nextIndex]
    setActiveTab(nextTab.id)
    requestAnimationFrame(() => document.getElementById(`search-tab-${nextTab.id}`)?.focus())
  }

  return (
    <PageFrame>
      <header className="mb-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-[var(--color-text)]">Search results</h1>
            {!browse && <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Matching “{query}” across firstmargin</p>}
          </div>
          {(topicOptions.length > 1 || timeOptions.length > 1 || sortOptions.length > 1) && <FilterPopover activeFilterCount={activeFilterCount} title="Refine results" description="Narrow the search without leaving the page." onClear={clearFilters}>
            {topicOptions.length > 1 && <div className="mt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Topic</p><div className="flex flex-wrap gap-2">{topicOptions.map(option => <button key={option.id} type="button" aria-pressed={topic === option.id} onClick={() => updateFilter('topic', option.id, 'all')} className={`button-target min-h-11 rounded-full border px-3 py-2 text-[11px] transition-colors sm:min-h-0 ${topic === option.id ? 'border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-text-inverted)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]'}`}>{option.label}</button>)}</div></div>}
            {(timeOptions.length > 1 || sortOptions.length > 1) && <div className="mt-4 grid grid-cols-2 gap-3">{timeOptions.length > 1 && <Select id="search-time" label="Time" value={time} options={timeOptions.map(option => ({ value: option.id, label: option.label }))} onChange={value => updateFilter('time', value, 'any')} className="max-w-none" />}{sortOptions.length > 1 && <Select id="search-sort" label="Sort" value={sort} options={sortOptions.map(option => ({ value: option.id, label: option.label }))} onChange={value => updateFilter('sort', value, 'relevance')} className="max-w-none" />}</div>}
          </FilterPopover>}
        </div>
      </header>

      <div role="tablist" aria-label="Search result types" className="-mx-1 mb-7 flex max-w-full gap-5 overflow-x-auto border-b border-[var(--color-border)] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(tab => <button key={tab.id} id={`search-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="search-results-panel" tabIndex={activeTab === tab.id ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab(tab.id)}
          className={`min-h-11 shrink-0 whitespace-nowrap pb-3 text-[13px] font-semibold border-b-2 ${activeTab === tab.id
            ? 'text-[var(--color-text)] border-[var(--color-accent)]'
            : 'text-[var(--color-text-muted)] border-transparent'}`}>{tab.label}</button>)}
      </div>

      <div id="search-results-panel" role="tabpanel" aria-labelledby={`search-tab-${activeTab}`}>
      {!result.isPending && !result.isError && <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">{browse ? activeTab === 'writers' ? 'Top authors' : `Popular ${resultTypes[1]}` : `Showing ${items.length} ${resultTypes[items.length === 1 ? 0 : 1]}`}</p>}
      {result.isPending && (['writers', 'questions'].includes(activeTab) ? <ListSkeleton count={4} label={activeTab === 'questions' ? 'Loading question results' : 'Loading writer results'} /> : <PostFeedSkeleton count={3} short={activeTab === 'shorts'} label={`Loading ${activeTab === 'shorts' ? 'short' : 'story'} search results`} />)}
      {result.isError && <SearchState isError busy={result.isFetching} title="Search is unavailable" detail="Please check your connection and try again." onRetry={() => result.refetch()} />}
      {!result.isPending && !result.isError && items.length === 0 && (
        <SearchState title={`No ${activeTab === 'posts' ? 'stories' : activeTab} found`} detail={browse ? 'Try changing the filters or come back later.' : 'Try a broader phrase or a different spelling.'} />
      )}
      {items.length > 0 && <section aria-live="polite" className={activeTab === 'shorts' ? 'card-grid card-grid--short gap-4' : ''}>
        {activeTab === 'posts'
          ? items.map(post => <DiscoveryPostCard key={post.id} post={post} flushTop={false} />)
          : activeTab === 'writers'
            ? items.map(writer => <WriterResult key={writer.id} writer={writer} />)
            : activeTab === 'questions'
              ? items.map(question => <QuestionCard key={question.id} question={question} />)
              : items.map(post => <ShortCard key={post.id} post={post} fluid onOpen={short => setShortReadId(short.id)} />)}
      </section>}
      </div>
      {shortReadId && <ShortReadModal postId={shortReadId} onClose={() => setShortReadId(null)} />}
    </PageFrame>
  )
}
