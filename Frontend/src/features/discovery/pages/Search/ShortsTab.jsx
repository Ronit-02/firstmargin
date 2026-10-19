/* eslint-disable react-hooks/exhaustive-deps -- The observer depends on the stable query members it consumes. */
import retainRetryView from '@/shared/utils/retainRetryView'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import useShorts from '../../hooks/useShorts'
import ShortReadModal from '../../components/ShortReadModal'
import PageHeader from '@/shared/components/ui/PageHeader'
import { ShortCardSkeleton } from '@/shared/components/ui/Skeleton'
import PageFrame from '@/shared/components/layout/PageFrame'
import ShortCard from '../../components/ShortCard'
import FilterBar from '@/shared/components/ui/FilterBar'
import { tagFilterOptions } from '@/shared/utils/availableFilterOptions'

export default function ShortsTab() {
  const feedSentinelRef = useRef(null)
  const [params, setParams] = useSearchParams()
  const [shortReadId, setShortReadId] = useState(null)
  const requestedTopic = params.get('shortTopic')
  const requestedSort = params.get('shortSort')
  const sort = ['latest', 'popular'].includes(requestedSort) ? requestedSort : 'latest'
  const query = retainRetryView(useShorts(sort))
  const shorts = query.data?.pages.flatMap(page => page.data) || []
  const topicOptions = tagFilterOptions(shorts, requestedTopic, query.hasNextPage)
  const topic = topicOptions.some(option => option.id === requestedTopic) ? requestedTopic : 'all'
  const filteredShorts = topic === 'all' ? shorts : shorts.filter(post => (post.tags || []).some(tag => tag.toLowerCase() === topic))
  useEffect(() => {
    const node = feedSentinelRef.current
    if (!node || !('IntersectionObserver' in window)) return undefined
    const root = node.closest('[data-app-scroll]')
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) query.fetchNextPage()
    }, { root, rootMargin: '520px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage, query.isFetchNextPageError])
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
      return next
    })
  }
  const resetFilters = () => setParams(current => {
    const next = new URLSearchParams(current)
    next.delete('shortTopic')
    next.delete('shortSort')
    return next
  })
  return <PageFrame><PageHeader eyebrow="Fast learning" title="Shorts" description="Focused ideas under 500 words." /><div className="mb-5 flex items-center justify-between gap-4"><h2 className="mb-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Latest shorts</h2>{shorts.length > 0 && <FilterBar label="Topic" options={topicOptions} value={topic} onChange={value => updateFilter('shortTopic', value, 'all')} sortOptions={[{ id: 'latest', label: 'Latest' }, { id: 'popular', label: 'Most appreciated' }]} sortValue={sort} onSortChange={value => updateFilter('shortSort', value, 'latest')} onReset={resetFilters} />}</div>{query.isPending && <div role="status" aria-label="Loading shorts" className="card-grid card-grid--short gap-4"><ShortCardSkeleton /><ShortCardSkeleton /><ShortCardSkeleton /><ShortCardSkeleton /></div>}{query.isError && <div className="py-16 text-center"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Shorts could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div>}<section className="card-grid card-grid--short gap-4">{filteredShorts.map(post => <ShortCard key={post.id} post={post} fluid onOpen={short => setShortReadId(short.id)} />)}</section>{!query.isPending && !query.isError && !query.hasNextPage && filteredShorts.length === 0 && <p className="py-16 text-center text-[13px] text-[var(--color-text-muted)]">No shorts match this topic.</p>}<div ref={feedSentinelRef} aria-hidden="true" className="h-1" />{query.isFetchingNextPage && <div role="status" aria-label="Loading more shorts" className="card-grid card-grid--short mt-8 gap-4"><ShortCardSkeleton /><ShortCardSkeleton /></div>}{shortReadId && <ShortReadModal postId={shortReadId} onClose={() => setShortReadId(null)} listIds={filteredShorts.map(post => post.id)} />}</PageFrame>
}
