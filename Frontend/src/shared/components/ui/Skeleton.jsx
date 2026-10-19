export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[8px] bg-[var(--color-bg-alt)] ${className}`} />
}

export function PostCardSkeleton({ compact = false }) {
  return (
    <article aria-label="Loading story" className={`rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${compact ? '' : 'min-h-64'}`}>
      <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex-1"><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-2.5 w-20" /></div></div>
      <Skeleton className="mt-6 h-6 w-4/5" /><Skeleton className="mt-2 h-6 w-3/5" />
      <Skeleton className="mt-4 h-3 w-full" /><Skeleton className="mt-2 h-3 w-11/12" />
      <div className="mt-6 flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /></div>
    </article>
  )
}

export function ShortCardSkeleton() {
  return <article aria-label="Loading short" className="flex w-full self-start flex-col overflow-hidden rounded-[16px] border border-[var(--color-border)] aspect-[2/3] min-h-[285px] min-[360px]:max-[407px]:min-h-[270px]">
    <div className="flex min-h-[35%] shrink-0 flex-col bg-[var(--color-bg)] p-2.5 min-[360px]:max-[407px]:min-h-[42%] min-[360px]:max-[407px]:p-2">
      <div className="flex min-h-11 items-start justify-between"><Skeleton className="mt-4 h-2.5 w-16" /><Skeleton className="h-9 w-9 rounded-full" /></div>
      <Skeleton className="mt-2 h-5 w-11/12" /><Skeleton className="mt-2 h-5 w-3/4" />
    </div>
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-bg-alt)] px-2.5 pb-2 pt-3 min-[360px]:max-[407px]:px-2">
      <Skeleton className="h-3 w-full" /><Skeleton className="mt-2 h-3 w-11/12" /><Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-auto flex min-h-11 items-center gap-2 border-t border-[var(--color-border)] pt-1"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-3 w-16" /><div className="ml-auto flex gap-2"><Skeleton className="h-4 w-8" /><Skeleton className="h-4 w-8" /></div></div>
    </div>
  </article>
}

export function PostFeedSkeleton({ count = 3, grid = false, short = false, label = 'Loading stories' }) {
  return <div role="status" aria-label={label} className={short ? 'card-grid card-grid--short gap-4' : grid ? 'card-grid card-grid--post gap-4' : 'flex flex-col gap-4'}>{Array.from({ length: count }, (_, index) => short ? <ShortCardSkeleton key={index} /> : <PostCardSkeleton key={index} />)}</div>
}

export function ShortDetailSkeleton() {
  return <div role="status" aria-label="Loading short" className="w-full">
    <Skeleton className="h-7 w-10/12" /><Skeleton className="mt-2 h-7 w-2/3" />
    <div className="mt-5 flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-2.5 w-16" /></div></div>
    <div className="my-7 border-t border-[var(--color-border)]" />
    <Skeleton className="h-3.5 w-full" /><Skeleton className="mt-3 h-3.5 w-11/12" /><Skeleton className="mt-3 h-3.5 w-full" /><Skeleton className="mt-3 h-3.5 w-3/4" />
    <Skeleton className="mt-7 h-3.5 w-full" /><Skeleton className="mt-3 h-3.5 w-5/6" />
  </div>
}

export function PostDetailSkeleton({ as = 'main', label = 'Loading story', className = '' }) {
  const Container = as
  return (
    <Container role="status" aria-label={label} className={`mx-auto w-full max-w-[800px] px-4 pt-8 pb-20 sm:px-6 lg:px-8 ${className}`}>
      <Skeleton className="mb-7 h-8 w-20 rounded-full" />
      <Skeleton className="mb-8 h-[clamp(180px,30vw,320px)] w-full rounded-[20px]" />
      <Skeleton className="h-10 w-11/12" /><Skeleton className="mt-3 h-10 w-3/5" />
      <div className="mt-6 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-2.5 w-20" /></div></div><div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /></div></div>
      <Skeleton className="mt-8 h-4 w-full" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-4 h-4 w-10/12" /><Skeleton className="mt-10 h-6 w-2/5" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-4 h-4 w-11/12" /><Skeleton className="mt-4 h-4 w-9/12" />
    </Container>
  )
}

export function ListSkeleton({ count = 4, label = 'Loading content', role = 'status' }) {
  return <div role={role} aria-label={role ? label : undefined} className="flex flex-col">{Array.from({ length: count }, (_, index) => <div key={index} className="flex gap-4 border-b border-[var(--color-border)] py-5"><Skeleton className="h-10 w-10 shrink-0 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-3/5" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></div></div>)}</div>
}
