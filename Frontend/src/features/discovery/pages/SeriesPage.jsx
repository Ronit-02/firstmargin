import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageFrame from '@/shared/components/layout/PageFrame'
import BrowseTabs from '@/shared/components/layout/BrowseTabs'
import PageHeader from '@/shared/components/ui/PageHeader'
import Button from '@/shared/components/ui/Button'
import FilterBar from '@/shared/components/ui/FilterBar'
import Pill from '@/shared/components/ui/Pill'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import useAuth from '@/features/auth/hooks/useAuth'
import retainRetryView from '@/shared/utils/retainRetryView'
import SeriesCard from '../components/SeriesCard'
import CreateSeriesModal from '../components/CreateSeriesModal'
import { useShortSeriesList } from '../hooks/useShortSeries'

const TYPES = [{ id: 'article', label: 'Stories' }, { id: 'short', label: 'Shorts' }]

export default function SeriesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loggedIn, signIn } = useAuth()
  const type = params.get('type') === 'short' ? 'short' : 'article'
  const sort = ['latest', 'title', 'parts'].includes(params.get('seriesSort')) ? params.get('seriesSort') : 'latest'
  const query = retainRetryView(useShortSeriesList(type))
  const series = query.data?.pages.flatMap(page => page.data) || []
  const sortedSeries = [...series].sort((left, right) => sort === 'title' ? left.title.localeCompare(right.title) : sort === 'parts' ? (right.entriesCount || 0) - (left.entriesCount || 0) : new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
  const [showCreate, setShowCreate] = useState(false)
  const setType = next => setParams(current => { const value = new URLSearchParams(current); if (next === 'article') value.delete('type'); else value.set('type', next); return value })
  const setSort = value => setParams(current => { const next = new URLSearchParams(current); if (value === 'latest') next.delete('seriesSort'); else next.set('seriesSort', value); return next })
  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'article' : event.key === 'End' ? 'short' : type === 'article' ? 'short' : 'article'
    setType(next)
    requestAnimationFrame(() => document.getElementById(`series-tab-${next}`)?.focus())
  }
  return <PageFrame><BrowseTabs /><PageHeader eyebrow="Reading paths" title="Series" description="Follow stories or shorts in an order chosen by their writer." actions={<Button onClick={() => loggedIn ? setShowCreate(true) : signIn()}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Create a series</Button>} /><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div role="tablist" aria-label="Series format" className="flex gap-2">{TYPES.map(item => <Pill key={item.id} id={`series-tab-${item.id}`} label={item.label} role="tab" ariaControls="series-panel" tabIndex={type === item.id ? 0 : -1} active={type === item.id} onClick={() => setType(item.id)} onKeyDown={handleTabKeyDown} />)}</div>{series.length > 0 && <FilterBar label="Series" options={[]} sortOptions={[{ id: 'latest', label: 'Newest' }, { id: 'title', label: 'Title A–Z' }, { id: 'parts', label: 'Most parts' }]} sortValue={sort} onSortChange={setSort} onReset={() => setSort('latest')} />}</div><section id="series-panel" role="tabpanel" aria-labelledby={`series-tab-${type}`}>{query.isPending && <ListSkeleton count={4} label="Loading series" />}{query.isError && <div className="py-16 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Series could not be loaded.</p><Button variant="secondary" className="mt-4" onClick={() => query.refetch()} disabled={query.isFetching} aria-busy={query.isFetching}>Try again</Button></div>}<div className="card-grid card-grid--series gap-4">{sortedSeries.map(item => <SeriesCard key={item.id} series={item} />)}</div>{!query.isPending && !query.isError && !series.length && <p className="py-16 text-center text-[13px] text-[var(--color-text-muted)]">No {type === 'short' ? 'short' : 'story'} series yet.</p>}<InfiniteScrollSentinel query={query} className="pt-9" /></section>{showCreate && <CreateSeriesModal onClose={() => setShowCreate(false)} onCreated={id => navigate(`/series/${id}`)} />}</PageFrame>
}
