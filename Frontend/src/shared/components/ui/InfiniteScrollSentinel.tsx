import { useEffect, useRef } from 'react'
import Button from './Button'

export type PageQuery = {
  hasNextPage?: boolean
  isFetching?: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError?: boolean
  fetchNextPage: () => unknown
}

type Props = {
  query: PageQuery
  disabled?: boolean
  className?: string
  label?: string
  rootMargin?: string
}

function scrollRoot(node: HTMLElement): Element | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent.matches('[data-app-scroll]') || /auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

export default function InfiniteScrollSentinel({ query, disabled = false, className = '', label = 'Loading more', rootMargin = '360px 0px' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } = query

  useEffect(() => {
    const node = ref.current
    if (!node || !hasNextPage || disabled || isFetching || isFetchNextPageError || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchNextPage()
    }, { root: scrollRoot(node), rootMargin })
    observer.observe(node)
    return () => observer.disconnect()
  }, [disabled, fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, rootMargin])

  if (!hasNextPage) return null
  return <div className={className}>
    <div ref={ref} aria-hidden="true" className="h-1" />
    {isFetchingNextPage && <p role="status" className="py-3 text-center text-[12px] text-[var(--color-text-muted)]">{label}…</p>}
    {isFetchNextPageError && <div role="alert" className="py-3 text-center text-[12px] text-[var(--color-danger)]">More items could not be loaded. <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>Try again</Button></div>}
  </div>
}
