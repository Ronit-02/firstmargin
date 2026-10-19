import { Link } from 'react-router-dom'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'
import ImageBox from '@/shared/components/ui/ImageBox'
import { PostCardMenu } from './DiscoveryPostCard'
import PostEngagementControls from './PostEngagementControls'

type FeaturedPost = {
  id: string
  title: string
  image?: string | null
  excerpt?: string
  createdAt?: string
  readTime?: string
  author?: { username: string; handle?: string | null; picture?: string | null }
  isLiked?: boolean
  isBookmarked?: boolean
  likesCount?: number
  commentsCount?: number
}

export default function FeaturedPostCard({ post, label = 'Story of the day', readerVotes }: { post: FeaturedPost; label?: string; readerVotes?: number }) {
  return (
    <article className="group relative grid overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] min-[960px]:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <p className="px-5 py-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] min-[960px]:col-span-2 min-[960px]:px-7">{label}</p>
      <Link to={`/post/${post.id}`} aria-label={`Read ${post.title}`} className="relative z-10 block aspect-[16/9] min-w-0 overflow-hidden min-[960px]:aspect-auto min-[960px]:self-stretch [&>div]:absolute [&>div]:inset-0">
        <ImageBox src={post.image} alt="" height="100%" radius="0" />
      </Link>
      <div className="flex min-w-0 flex-col gap-5 p-5 min-[960px]:px-7 min-[960px]:pb-7 min-[960px]:pt-0">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="relative z-10 min-w-0 flex-1 [&>div]:gap-2 [&>div>div]:flex-wrap [&>div>a]:min-w-0 [&>div>a]:max-w-full [&>div>a>span]:min-w-0 [&>div>a>span]:break-words">
              <AuthorMeta author={post.author} date={post.createdAt} readTime={post.readTime} stacked />
            </div>
            <PostCardMenu post={post} />
          </div>
          <h3 className="mt-5 break-words text-[clamp(24px,3vw,36px)] font-bold leading-[1.18] tracking-[-0.04em] text-[var(--color-text)] group-hover:text-[var(--color-accent)]" style={{ fontFamily: 'var(--font-display)' }}>
            <Link to={`/post/${post.id}`} className="rounded-[4px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">{post.title}</Link>
          </h3>
          {post.excerpt && <p className="mt-4 line-clamp-3 break-words text-[13px] leading-6 text-[var(--color-text-secondary)]">{post.excerpt}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center">
          <PostEngagementControls post={post} />
        </div>
        {readerVotes !== undefined && <p className="text-[12px] text-[var(--color-text-secondary)]">{readerVotes} reader {readerVotes === 1 ? 'vote' : 'votes'}</p>}
      </div>
    </article>
  )
}
