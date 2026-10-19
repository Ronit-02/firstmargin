import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '@/shared/components/ui/Avatar'
import ImageBox from '@/shared/components/ui/ImageBox'
import PostEngagementControls from './PostEngagementControls'
import PostCardMenu from './PostCardMenu'
import ShortReadModal from './ShortReadModal'

export default function ShortCard({ post, onHide, onOpen, menuOverride, fluid = false }) {
  const authorName = post.author?.username || 'Unknown writer'
  const firstName = authorName.trim().split(/\s+/)[0]
  const authorHandle = post.author?.handle || (authorName !== 'Unknown writer' ? authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null)
  const firstTag = post.tags?.find(tag => typeof tag === 'string' && tag.trim())?.trim()
  const [readerOpen, setReaderOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const cardRef = useRef(null)
  const contentRef = useRef(null)
  const excerptRef = useRef(null)
  const [excerptClamp, setExcerptClamp] = useState(null)

  useEffect(() => {
    const card = cardRef.current
    const content = contentRef.current
    const excerpt = excerptRef.current
    if (!card || !content || !excerpt) return undefined
    const update = () => {
      const lineHeight = parseFloat(getComputedStyle(excerpt).lineHeight)
      const available = Math.max(0, content.getBoundingClientRect().bottom - excerpt.getBoundingClientRect().top)
      const lines = Math.max(0, Math.floor((available + 0.5) / lineHeight))
      setExcerptClamp(current => current?.lines === lines && current?.height === lines * lineHeight
        ? current
        : { lines, height: lines * lineHeight })
    }
    let active = true
    const observer = new ResizeObserver(update)
    observer.observe(card)
    observer.observe(content)
    Array.from(card.querySelectorAll('img')).forEach(image => observer.observe(image))
    update()
    document.fonts?.ready.then(() => { if (active) update() })
    return () => { active = false; observer.disconnect() }
  }, [post.excerpt, post.image, post.title, fluid])
  const handleOpen = event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (onOpen) onOpen(post)
    else setReaderOpen(true)
  }

  if (isHidden) return null

  return <article ref={cardRef} data-story-format="short" className={`group relative flex w-full self-start flex-col overflow-hidden rounded-[16px] border border-[var(--color-border)] ${fluid ? 'aspect-[2/3] min-h-[285px] min-[360px]:max-[407px]:min-h-[270px]' : 'h-[380px] max-w-[250px]'}`}>
    {post.image && <Link to={`/post/${post.id}`} onClick={handleOpen} aria-label={`Read ${post.title}`} className="relative z-10 shrink-0"><ImageBox src={post.image} alt="" height="auto" aspectRatio="16 / 9" radius="0px" /></Link>}
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className={`flex shrink-0 flex-col bg-[var(--color-bg)] ${post.image ? '' : fluid ? 'min-h-[35%] min-[360px]:max-[407px]:min-h-[42%]' : 'min-h-[42%]'} ${fluid ? 'p-2.5 min-[360px]:max-[407px]:p-2' : 'p-4'}`}>
        <div className="flex min-h-11 items-start justify-between gap-1">
          {firstTag ? <span className="min-w-0 self-center truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]" title={firstTag}>{firstTag}</span> : <span aria-hidden="true" className="mt-5 h-[2px] w-6 shrink-0 rounded-full bg-[var(--color-text-muted)]" />}
          {menuOverride ? <div className="relative z-20 shrink-0">{menuOverride}</div> : <PostCardMenu post={post} variant="short" onHide={hidden => { if (onHide) onHide(hidden); else setIsHidden(true) }} />}
        </div>
        <h2 className={`${fluid ? 'text-[18px]' : 'text-[22px]'} mt-1 line-clamp-2 break-words font-bold leading-[1.3] tracking-[-0.045em] text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]`} style={{ fontFamily: 'var(--font-display)' }}>
          <Link to={`/post/${post.id}`} onClick={handleOpen} className="after:absolute after:inset-0 after:rounded-[16px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--color-focus)]">{post.title}</Link>
        </h2>
      </div>
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-alt)] ${fluid ? 'px-2.5 pt-3 pb-2 min-[360px]:max-[407px]:px-2' : 'px-4 pt-4 pb-3'}`}>
        <div ref={contentRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {post.excerpt && <p ref={excerptRef} className="min-h-0 flex-1 break-words text-[13px] leading-[1.6] text-[var(--color-text-secondary)]" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: Math.max(1, excerptClamp?.lines || 1), maxHeight: excerptClamp ? `${excerptClamp.height}px` : 0, overflow: 'hidden', visibility: excerptClamp?.lines ? undefined : 'hidden' }}>{post.excerpt}</p>}
        </div>
        <div className="flex min-h-11 shrink-0 items-center gap-1 border-t border-[var(--color-border)] pt-1">
          {authorHandle ? <Link to={`/author/${encodeURIComponent(authorHandle)}`} onClick={event => event.stopPropagation()} aria-label={`View ${authorName}'s profile`} className="relative z-10 flex min-w-0 flex-1 items-center gap-1 rounded-[4px] transition-colors hover:!text-[var(--color-text)] hover:[&>span]:!text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><Avatar src={post.author?.picture} name={authorName} size={20} /><span className="min-w-0 truncate text-[11px] text-[var(--color-text-secondary)]" title={authorName}>{firstName}</span></Link> : <span className="flex min-w-0 flex-1 items-center gap-1"><Avatar name={authorName} size={20} /><span className="min-w-0 truncate text-[11px] text-[var(--color-text-secondary)]" title={authorName}>{firstName}</span></span>}
          <PostEngagementControls post={post} compact />
        </div>
      </div>
    </div>
    {readerOpen && <ShortReadModal postId={post.id} onClose={() => setReaderOpen(false)} />}
  </article>
}
