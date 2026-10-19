/* eslint-disable react-hooks/exhaustive-deps -- The observer depends on the stable query members it consumes. */
import { useEffect, useRef } from 'react'
import retainRetryView from '@/shared/utils/retainRetryView'
import { useSearchParams } from 'react-router-dom'
import useDiscoveryFeed from '../../hooks/useDiscoveryFeed'
import DiscoveryPostCard from '../../components/DiscoveryPostCard'
import FeaturedPostCard from '../../components/FeaturedPostCard'
import PageHeader from '@/shared/components/ui/PageHeader'
import SectionHeading from '@/shared/components/ui/SectionHeading'
import { PostFeedSkeleton } from '@/shared/components/ui/Skeleton'
import FilterBar from '@/shared/components/ui/FilterBar'
import { tagFilterOptions } from '@/shared/utils/availableFilterOptions'

export default function TrendingTab() {
  const feedSentinelRef = useRef(null)
  const [params, setParams] = useSearchParams()
  const requestedSort = params.get('trendingSort')
  const sort = ['popular', 'latest'].includes(requestedSort) ? requestedSort : 'popular'
  const feed = retainRetryView(useDiscoveryFeed('popular', sort))
  const requestedTopic = params.get('trendingTopic')
  const posts = feed.data?.pages.flatMap(page => page.data) || []
  const topicOptions = tagFilterOptions(posts, requestedTopic, feed.hasNextPage)
  const topic = topicOptions.some(option => option.id === requestedTopic) ? requestedTopic : 'all'
  const filteredPosts = topic === 'all' ? posts : posts.filter(post => (post.tags || []).some(tag => tag.toLowerCase() === topic))
  const articleOfDay = posts.find(post => post.format !== 'short')
  const trendingStories = filteredPosts.filter(post => post.format !== 'short' && post.id !== articleOfDay?.id)
  const trendingShorts = filteredPosts.filter(post => post.format === 'short')
  useEffect(() => {
    const node = feedSentinelRef.current
    if (!node || !('IntersectionObserver' in window)) return undefined
    const root = node.closest('[data-app-scroll]')
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
    }, { root, rootMargin: '520px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [feed.fetchNextPage, feed.hasNextPage, feed.isFetchingNextPage])
  const resetFilters = () => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.delete('trendingTopic')
      next.delete('trendingSort')
      return next
    })
  }
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
      return next
    })
  }
  return (
    <section aria-labelledby="trending-heading">
      <PageHeader headingId="trending-heading" eyebrow="Explore" title="Trending now" description="Stories readers are responding to." />
      {articleOfDay && <section className="mb-12">
        <FeaturedPostCard post={articleOfDay} />
      </section>}
      <section aria-label="Trending stories">
      <div className="mb-4 mt-5 grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><SectionHeading className="min-w-0">Trending stories</SectionHeading>{posts.length > 0 && <div className="shrink-0 sm:justify-self-end"><FilterBar label="Topic" value={topic} onReset={resetFilters} onChange={value => updateFilter('trendingTopic', value, 'all')} options={topicOptions} sortOptions={[{ id: 'popular', label: 'Most appreciated' }, { id: 'latest', label: 'Latest' }]} sortValue={sort} onSortChange={value => updateFilter('trendingSort', value, 'popular')} /></div>}</div>
      {feed.isPending && <PostFeedSkeleton count={3} label="Loading trending stories" />}
      {feed.isError && <div role="alert" className="py-12"><p className="text-[13px] text-[var(--color-danger)]">Popular stories are unavailable.</p><button type="button" onClick={() => feed.refetch()} className="button-target mt-3 inline-flex min-h-11 items-center text-[12px] font-semibold underline sm:min-h-0" aria-busy={feed.isFetching} disabled={feed.isFetching}>Try again</button></div>}
      {!feed.isPending && !feed.isError && posts.length === 0 && <p className="py-12 text-[13px] text-[var(--color-text-muted)]">Popular stories will appear as readers begin responding.</p>}
      {trendingStories.map(post => <DiscoveryPostCard key={post.id} post={post} />)}
      </section>
      {trendingShorts.length > 0 && <section className="mt-10" aria-labelledby="trending-shorts-heading"><h2 id="trending-shorts-heading" className="mb-4 text-[18px] font-bold text-[var(--color-text)]">Trending shorts</h2><div className="card-grid card-grid--short gap-4">{trendingShorts.map(post => <DiscoveryPostCard key={post.id} post={post} variant="grid" />)}</div></section>}
      <div ref={feedSentinelRef} aria-hidden="true" className="h-1" />
      {feed.isFetchingNextPage && <div className="fade-in mt-8 mb-4"><PostFeedSkeleton count={2} /></div>}
    </section>
  )
}
