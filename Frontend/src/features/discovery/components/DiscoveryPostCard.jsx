import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'
import ImageBox from '@/shared/components/ui/ImageBox'
import Tag from '@/shared/components/ui/Tag'
import PostEngagementControls from './PostEngagementControls'
import ShortCard from './ShortCard'
import PostCardMenu from './PostCardMenu'
import useFittingPills from '@/shared/hooks/useFittingPills'

export { PostCardMenu }

export default function DiscoveryPostCard(props) {
  return props.post.format === 'short' || props.variant === 'short'
    ? <ShortCard {...props} fluid={props.fluid ?? props.variant === 'grid'} />
    : <DiscoveryCard {...props} />
}

function GridExcerpt({ text }) {
  const spaceRef = useRef(null)
  const textRef = useRef(null)
  const [lines, setLines] = useState(1)

  useEffect(() => {
    const space = spaceRef.current
    const excerpt = textRef.current
    if (!space || !excerpt) return undefined
    let active = true
    const update = () => {
      const lineHeight = parseFloat(getComputedStyle(excerpt).lineHeight)
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return
      const next = Math.max(1, Math.min(3, Math.floor((space.clientHeight + 0.5) / lineHeight)))
      if (active) setLines(current => current === next ? current : next)
    }
    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(() => requestAnimationFrame(update))
    observer.observe(space)
    document.fonts?.ready.then(() => { if (active) requestAnimationFrame(update) })
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect() }
  }, [text])

  return <div ref={spaceRef} className="mt-3 min-h-0 flex-1 overflow-hidden">
    <p ref={textRef} className="overflow-hidden break-words text-[13px] leading-[1.65] text-[var(--color-text-secondary)] [display:-webkit-box] [-webkit-box-orient:vertical]" style={{ WebkitLineClamp: lines }}>{text}</p>
  </div>
}

function DiscoveryCard({ post, onHide, onOpen, comfortable = false, variant = 'list', flushTop = true, carousel = false }) {
  const [isHidden, setIsHidden] = useState(false)
  const tags = post.tags?.slice(0, 3) || []
  const { containerRef: tagsRef, visibleCount: visibleTags } = useFittingPills(tags, !isHidden)
  const hasListCover = Boolean(post.image && variant !== 'grid')
  const authorHandle = post.author?.handle || post.author?.username?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const handleOpen = event => {
    if (!onOpen) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpen(post)
  }

  if (isHidden) return null

  return (
    <article
      data-story-format="article"
      data-carousel-card={carousel || undefined}
      className={`group relative border-b border-[var(--color-border)] ${variant === 'grid' ? 'flex h-[400px] flex-col overflow-visible rounded-[16px] border bg-[var(--color-surface)]' : comfortable ? `${hasListCover ? 'max-[540px]:flex max-[540px]:flex-col' : ''} py-10 first:pt-10 max-[540px]:py-4 max-[540px]:first:pt-4` : `${hasListCover ? 'max-[540px]:flex max-[540px]:flex-col' : ''} py-6 ${flushTop ? 'first:pt-0' : ''}`}
        ${hasListCover ? 'min-[540px]:grid min-[540px]:grid-cols-[minmax(0,1fr)_200px] min-[540px]:gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8' : ''}`}
    >
      <div className={`min-w-0 flex flex-col ${variant === 'grid' ? 'order-last min-h-0 flex-1 p-4' : ''}`}>
        {post.isEarlyAccess && <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">Member early access</p>}
        <div className={`flex items-start justify-between gap-4 ${variant === 'list' ? 'max-[540px]:items-center' : ''} [&>div:first-child]:relative [&>div:first-child]:z-10 [&>div:first-child]:gap-2 [&>div:first-child>div]:flex-wrap [&>div:first-child>a]:min-w-0 [&>div:first-child>a]:max-w-full [&>div:first-child>a>span]:min-w-0 [&>div:first-child>a>span]:break-words`}>
          {variant === 'grid' ? <p className="relative z-10 min-w-0 truncate text-[11px] text-[var(--color-text-muted)]"><span>{post.readTime || 'Story'}</span> · {authorHandle ? <Link to={`/author/${encodeURIComponent(authorHandle)}`} aria-label={`View ${post.author.username}'s profile`} className="rounded-[4px] transition-colors hover:!text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">{post.author.username}</Link> : <>{post.author?.username || 'firstmargin writer'}</>}</p> : <AuthorMeta author={post.author} readTime={post.readTime} date={post.createdAt} size="sm" stacked compactMobile={variant === 'list'} />}
          <PostCardMenu post={post} variant={variant} compactMobile={variant === 'list'} onHide={hidden => { if (onHide) onHide(hidden); else setIsHidden(true) }} />
        </div>
        <h2 className={`${variant === 'grid' ? 'mt-3 shrink-0 text-[16px] leading-[1.3] tracking-[-0.045em]' : 'max-[540px]:mt-2 min-[540px]:mt-5 text-[20px] leading-[1.3] tracking-[-0.015em]'} line-clamp-2 break-words font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors`}
          style={{ fontFamily: 'var(--font-display)' }}>
          <Link to={`/post/${post.id}`} onClick={handleOpen} className="rounded-[4px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2"><span>{post.title}</span></Link>
        </h2>
        {post.excerpt && (variant === 'grid' ? <GridExcerpt text={post.excerpt} /> : <p className={`${variant === 'list' ? 'max-[540px]:hidden' : ''} line-clamp-3 mt-3 text-[13px] leading-[1.65] break-words text-[var(--color-text-secondary)]`}>{post.excerpt}</p>)}
        <div className={`${variant === 'list' ? hasListCover ? `mt-auto pt-3 min-[540px]:pt-5 ${comfortable ? 'max-[540px]:pt-2' : ''} max-[540px]:grid max-[540px]:grid-cols-[minmax(0,1fr)_auto] max-[540px]:items-start max-[540px]:gap-x-3` : 'mt-auto pt-3 md:pt-5 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-start max-md:gap-x-3' : `${post.excerpt ? '' : 'mt-auto '}shrink-0 pt-5`} flex flex-nowrap items-center gap-x-2`}>
          {variant !== 'grid' && <div ref={tagsRef} className={`${variant === 'list' ? hasListCover ? 'max-[540px]:py-[7px]' : 'max-md:py-[7px]' : ''} flex min-w-0 flex-1 flex-nowrap gap-2 overflow-hidden`}>
            {tags.map((tag, index) => <span key={tag} aria-hidden={index >= visibleTags} className={`relative z-10 shrink-0 ${index >= visibleTags ? 'invisible' : ''}`}><Tag label={tag} clickable={index < visibleTags} /></span>)}
          </div>}
          <PostEngagementControls post={post} />
        </div>
      </div>
      {(post.image || variant === 'grid') && <Link to={`/post/${post.id}`} onClick={handleOpen} aria-label={`Read ${post.title}`} className={`relative z-10 ${variant === 'grid' ? 'order-first shrink-0 overflow-hidden rounded-t-[16px]' : `max-[540px]:order-[-1] ${comfortable ? 'max-[540px]:mb-4' : 'max-[540px]:mb-3'} min-[540px]:order-last min-[540px]:self-center [--list-cover-height:140px] max-[540px]:[--list-cover-height:auto]`}`}><ImageBox src={post.image} alt="" height={variant === 'grid' ? 180 : 'var(--list-cover-height)'} aspectRatio={variant === 'grid' ? undefined : '16 / 9'} radius={variant === 'grid' ? '0' : '6px'} /></Link>}
    </article>
  )
}
