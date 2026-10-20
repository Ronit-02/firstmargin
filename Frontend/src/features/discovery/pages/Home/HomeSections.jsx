import retainRetryView from '@/shared/utils/retainRetryView'
/* eslint-disable react-hooks/set-state-in-effect -- IntersectionObserver fallback intentionally activates deferred content synchronously. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- Carousel pointer dragging supplements native scrolling and focusable content. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '@/shared/components/ui/Avatar'
import SectionHeading from '@/shared/components/ui/SectionHeading'
import Button from '@/shared/components/ui/Button'
import { useCollections } from '@/features/collection/hooks/useCollections'
import CollectionCard from '@/features/collection/components/CollectionCard'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import ShortCard from '@/features/discovery/components/ShortCard'
import useShorts from '@/features/discovery/hooks/useShorts'

function SectionBar({ title, action, description }) {
  return <div className="mb-5 grid grid-cols-1 items-center gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-y-1">
    <div className="min-w-0"><SectionHeading className="min-w-0">{title}</SectionHeading>{description && <p className="text-[13px] text-[var(--color-text-secondary)]">{description}</p>}</div>
    {action && <div className="shrink-0 whitespace-nowrap sm:justify-self-end">{action}</div>}
  </div>
}

function SectionPlaceholder() {
  return <div role="status" aria-label="Loading discovery section" className="animate-pulse">
    <div className="h-6 w-44 rounded bg-[var(--color-bg-alt)]" />
    <div className="mt-3 h-3 w-72 max-w-full rounded bg-[var(--color-bg-alt)]" />
    <div className="card-grid card-grid--post mt-6 gap-4">
      <div className="h-32 rounded-[14px] bg-[var(--color-bg-alt)]" />
      <div className="h-32 rounded-[14px] bg-[var(--color-bg-alt)]" />
      <div className="hidden h-32 rounded-[14px] bg-[var(--color-bg-alt)] lg:block" />
      <div className="hidden h-32 rounded-[14px] bg-[var(--color-bg-alt)] lg:block" />
    </div>
  </div>
}

function DeferredSection({ children }) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (active || !ref.current) return undefined
    if (!('IntersectionObserver' in window)) {
      setActive(true)
      return undefined
    }
    const root = ref.current.closest('[data-app-scroll]')
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true)
        observer.disconnect()
      }
    }, { root, rootMargin: '240px 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [active])

  return <div ref={ref} className="my-6 border-b border-[var(--color-border)] py-8">
    {active ? <div className="fade-in">{children}</div> : <SectionPlaceholder />}
  </div>
}

function DraggableCarousel({ children, label, className = '' }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return undefined
    const update = () => setOverflow(track.scrollWidth > track.clientWidth + 2)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    Array.from(track.children).forEach(child => observer.observe(child))
    return () => observer.disconnect()
  }, [children])

  const startDrag = event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !overflow) return
    dragRef.current = { x: event.clientX, scrollLeft: trackRef.current.scrollLeft, moved: false }
  }
  const moveDrag = event => {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved && Math.abs(event.clientX - drag.x) > 3) {
      drag.moved = true
      trackRef.current.setPointerCapture(event.pointerId)
      trackRef.current.style.userSelect = 'none'
    }
    if (drag.moved) {
      event.preventDefault()
      trackRef.current.scrollLeft = drag.scrollLeft - (event.clientX - drag.x)
    }
  }
  const endDrag = () => {
    if (dragRef.current?.moved) {
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
    }
    if (trackRef.current) trackRef.current.style.userSelect = ''
    dragRef.current = null
  }

  return <div>
    {overflow && <p className="-mt-2 mb-3 text-right text-[11px] text-[var(--color-text-muted)]">Swipe or drag ↔</p>}
    <div ref={trackRef} role="region" aria-label={label} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDragStart={event => { if (overflow) event.preventDefault() }} onClickCapture={event => { if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressClickRef.current = false } }} className={`${className} overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch] ${overflow ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      {children}
    </div>
  </div>
}

function StoryCarousel({ posts, label }) {
  return <DraggableCarousel label={label} className="flex items-stretch gap-4 pb-3">
    {posts.map(post => <div key={post.id} className="flex w-[min(85%,320px)] shrink-0 snap-start [&>article]:w-full"><DiscoveryPostCard post={post} variant="grid" carousel /></div>)}
  </DraggableCarousel>
}

function CategorySection({ posts }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const categories = [...new Set(posts.flatMap(post => post.tags || []))].slice(0, 7)
  const visiblePosts = (selectedCategory ? posts.filter(post => post.tags?.includes(selectedCategory)) : posts).slice(0, 4)
  if (!categories.length) return null
  return <section>
    <SectionBar title="Browse categories" description="Follow a thread of curiosity through the latest writing." action={<Link to={selectedCategory ? `/search?q=${encodeURIComponent(selectedCategory)}` : '/search'} className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">View more →</Link>} />
    <DraggableCarousel label="Browse categories" className="flex gap-2 pb-2">
      {categories.map(category => <button key={category} type="button" aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(current => current === category ? null : category)} className={`button-target min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-[12px] font-medium transition-colors sm:min-h-0 ${selectedCategory === category ? 'border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-text-inverted)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]'}`}>{category}</button>)}
    </DraggableCarousel>
    {visiblePosts.length > 0 ? <div className="mt-6"><StoryCarousel posts={visiblePosts} label="Browse categories stories" /></div> : <p className="mt-6 py-8 text-center text-[13px] text-[var(--color-text-muted)]">No stories match this category yet.</p>}
  </section>
}

function CollectionsSection() {
  const query = retainRetryView(useCollections(false))
  const collections = query.data?.pages.flatMap(page => page.data) || []
  if (query.isPending) return <section><SectionBar title="Browse collections" description="Explore stories gathered around shared themes." /><div role="status" aria-label="Loading collections" className="card-grid card-grid--collection card-grid--collection-home gap-4"><div className="h-40 animate-pulse rounded-[16px] bg-[var(--color-bg-alt)]" /><div className="h-40 animate-pulse rounded-[16px] bg-[var(--color-bg-alt)]" /></div></section>
  if (query.isError) return <section><SectionBar title="Browse collections" description="Explore stories gathered around shared themes." /><div role="alert" className="border-y border-[var(--color-border)] py-8"><p className="text-[13px] text-[var(--color-danger)]">Collections could not be loaded.</p><button type="button" onClick={() => query.refetch()} className="button-target mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[12px] font-semibold text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0" aria-busy={query.isFetching} disabled={query.isFetching}>Try again</button></div></section>
  if (!collections.length) return null
  return <section><SectionBar title="Browse collections" description="Explore stories gathered around shared themes." action={<Link to="/collections" className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">See all →</Link>} /><div className="card-grid card-grid--collection card-grid--collection-home gap-4">{collections.slice(0, 2).map(collection => <CollectionCard key={collection.id} collection={collection} />)}</div></section>
}

function WriterPicks({ posts }) {
  if (!posts.length) return null
  return <section><SectionBar title="Writer's picks" description="Discover a few stories from writers in your feed." action={<Link to="/explore/trending" className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">View trending →</Link>} /><StoryCarousel posts={posts.slice(0, 4)} label="Writer's picks stories" /></section>
}

function ShortReadsSection({ offset = 0 }) {
  const query = retainRetryView(useShorts('latest'))
  const seen = new Set()
  const shorts = (query.data?.pages.flatMap(page => page.data) || [])
    .filter(post => post?.id && !seen.has(post.id) && seen.add(post.id))
    .slice(offset, offset + 4)

  if (!query.isPending && !query.isError && shorts.length === 0) return null

  return <section aria-label="Shorts" className="my-6 border-b border-[var(--color-border)] py-8">
    <SectionBar title="Shorts" description="Focused ideas under 500 words." action={<Link to="/shorts" className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">See all →</Link>} />
    {query.isPending && <div role="status" aria-label="Loading shorts" className="home-short-grid gap-4">
      {[0, 1, 2, 3].map(item => <div key={item} aria-hidden="true" className="aspect-[2/3] min-h-[285px] w-full animate-pulse rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] min-[360px]:max-[407px]:min-h-[270px]" />)}
    </div>}
    {query.isError && <div role="alert" className="border-y border-[var(--color-border)] py-6"><p className="text-[13px] text-[var(--color-danger)]">Shorts could not be loaded.</p><Button className="mt-3" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div>}
    {shorts.length > 0 && <div className="home-short-grid gap-4" aria-label="Latest shorts">
      {shorts.map(post => <ShortCard key={post.id} post={post} fluid />)}
    </div>}
  </section>
}

function TopAuthors({ posts }) {
  const authors = useMemo(() => {
    const map = new Map()
    posts.forEach(post => {
      if (!post.author?.id) return
      const current = map.get(post.author.id) || { ...post.author, stories: 0, likes: 0 }
      current.stories += 1
      current.likes += post.likesCount || 0
      map.set(post.author.id, current)
    })
    return [...map.values()].sort((a, b) => b.likes - a.likes || b.stories - a.stories).slice(0, 4)
  }, [posts])
  if (!authors.length) return null
  return <section><SectionBar title="Top authors" description="Meet the writers behind the stories in your feed." action={<Link to="/search?type=writers" className="button-target inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0">Find writers →</Link>} /><div className="grid grid-cols-1 gap-x-6 min-[540px]:grid-cols-2 lg:grid-cols-4">{authors.map((author, index) => <Link key={author.id} to={`/author/${author.handle || encodeURIComponent(author.username)}`} className="flex min-w-0 items-center gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2"><span className="w-5 shrink-0 text-[12px] text-[var(--color-text-muted)]">0{index + 1}</span><Avatar src={author.picture} name={author.username} size={40} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">{author.username}</span><span className="mt-1 block truncate text-[11px] text-[var(--color-text-muted)]">{author.stories} featured {author.stories === 1 ? 'story' : 'stories'}</span></span></Link>)}</div></section>
}

export default function HomeSections({ type, posts, shortOffset = 0 }) {
  const content = {
    writerPicks: <WriterPicks posts={posts} />,
    categories: <CategorySection posts={posts} />,
    collections: <CollectionsSection />,
    topAuthors: <TopAuthors posts={posts} />,
    shortReads: <ShortReadsSection offset={shortOffset} />,
  }[type]
  return type === 'shortReads' ? content : <DeferredSection>{content}</DeferredSection>
}
