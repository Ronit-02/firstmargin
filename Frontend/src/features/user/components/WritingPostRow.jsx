import { Link } from 'react-router-dom'
import WritingPostMenu from './WritingPostMenu'
import WritingStudioShortCard from './WritingStudioShortCard'

const postStatus = post => post.publicationStatus === 'unpublished' ? 'unpublished' : post.publicAt && new Date(post.publicAt).getTime() > Date.now() ? 'scheduled' : 'published'

export default function WritingPostRow({ post, manage = false }) {
  const id = post._id || post.id
  return <div className="flex items-start gap-4 py-7 border-b border-[var(--color-border)] sm:gap-5 sm:py-8">
    {post.format === 'short' ? <div className="min-w-0 flex-1"><WritingStudioShortCard post={post} /></div> : <>
      <Link to={`/post/${id}`} aria-label={`Read ${post.title}`} className="shrink-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">
        {post.coverImage ? <img src={post.coverImage} alt="" className="aspect-[5/4] w-20 rounded-[10px] object-cover bg-[var(--color-bg-alt)] sm:w-28" /> : <div className="aspect-[5/4] w-20 rounded-[10px] bg-[var(--color-bg-alt)] sm:w-28" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/post/${id}`} className="block text-[16px] font-semibold leading-[1.4] text-[var(--color-text)] [overflow-wrap:anywhere] hover:text-[var(--color-accent)] sm:text-[18px]">{post.title}</Link>
        <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[12px] leading-5 text-[var(--color-text-muted)]">
          <span>Story · {new Date(post.createdAt).toLocaleDateString()}</span>
          {postStatus(post) === 'unpublished' && <span>· Unpublished</span>}
          {postStatus(post) === 'scheduled' && <span>· Scheduled for {new Date(post.publicAt).toLocaleString()}</span>}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-secondary)]"><span>{post.likesCount || 0} {post.likesCount === 1 ? 'appreciation' : 'appreciations'}</span><span>{post.commentsCount || 0} {post.commentsCount === 1 ? 'comment' : 'comments'}</span></p>
      </div>
    </>}
    {manage && post.format !== 'short' && <div className="shrink-0"><WritingPostMenu post={post} /></div>}
  </div>
}
