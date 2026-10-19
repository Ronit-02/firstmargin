import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import retainRetryView from '@/shared/utils/retainRetryView'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import PageHeader from '@/shared/components/ui/PageHeader'
import useAuth from '@/features/auth/hooks/useAuth'
import { useCollections } from '../hooks/useCollections'
import { PostCardSkeleton } from '@/shared/components/ui/Skeleton'
import PageFrame from '@/shared/components/layout/PageFrame'
import BrowseTabs from '@/shared/components/layout/BrowseTabs'
import FilterBar from '@/shared/components/ui/FilterBar'
import { availableFilterOptions } from '@/shared/utils/availableFilterOptions'
import CollectionCard from '../components/CollectionCard'
import CreateCollectionModal from '../components/CreateCollectionModal'

export default function CollectionsPage() {
  const { loggedIn, signIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort = ['latest', 'popular'].includes(params.get('collectionSort')) ? params.get('collectionSort') : 'latest'
  const [showCreate, setShowCreate] = useState(false)
  const query = retainRetryView(useCollections(false, sort))
  const collections = query.data?.pages.flatMap(page => page.data) || []
  const visibilityOptions = availableFilterOptions([{ id: 'all', label: 'All' }, { id: 'public', label: 'Public' }, { id: 'unlisted', label: 'Unlisted' }, { id: 'private', label: 'Private' }], collections, item => [item.visibility], params.get('collectionVisibility'), query.hasNextPage)
  const visibility = visibilityOptions.some(option => option.id === params.get('collectionVisibility')) ? params.get('collectionVisibility') : 'all'
  const filteredCollections = visibility === 'all' ? collections : collections.filter(collection => collection.visibility === visibility)
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
      return next
    })
  }
  const resetFilters = () => {
    const next = new URLSearchParams(params)
    next.delete('collectionVisibility')
    next.delete('collectionSort')
    setParams(next)
  }
  return <PageFrame><BrowseTabs /><PageHeader eyebrow="Curated reading" title="Collections" description="Reading paths for stories worth keeping together." actions={<Button onClick={() => loggedIn ? setShowCreate(true) : signIn()}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Create collection</Button>} /><div className="mb-8 flex flex-wrap items-center justify-end gap-4">{collections.length > 0 && <FilterBar label="Visibility" value={visibility} onChange={value => updateFilter('collectionVisibility', value, 'all')} onReset={resetFilters} options={visibilityOptions.length > 2 || visibility !== 'all' ? visibilityOptions : []} sortOptions={[{ id: 'latest', label: 'Latest' }, { id: 'popular', label: 'Most saved' }]} sortValue={sort} onSortChange={value => updateFilter('collectionSort', value, 'latest')} />}</div><div>{query.isPending && <div role="status" aria-label="Loading collections"><div className="card-grid card-grid--collection gap-5">{Array.from({ length: 6 }, (_, index) => <PostCardSkeleton key={index} compact />)}</div></div>}{query.isError && <div role="alert" className="py-16 text-center"><p className="text-[13px] text-[var(--color-danger)]">Collections could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div>}{!query.isPending && !query.isError && filteredCollections.length === 0 && <p className="py-16 text-center text-[13px] text-[var(--color-text-muted)]">No collections match this filter.</p>}<section className="card-grid card-grid--collection gap-5">{filteredCollections.map(collection => <CollectionCard key={collection.id} collection={collection} />)}</section><InfiniteScrollSentinel query={query} className="pt-9" /></div>{showCreate && <CreateCollectionModal onClose={() => setShowCreate(false)} />}</PageFrame>
}
