import { useId, useState } from 'react'
import useAuth from '@/features/auth/hooks/useAuth'
import usePostLike from '@/features/post/hooks/usePostLike'
import CommentsModal from '@/features/post/components/CommentsModal'
import AppreciationButton from '@/features/post/components/AppreciationButton'

type EngagementPost = {
  id: string
  title: string
  isLiked?: boolean
  likesCount?: number
  commentsCount?: number
}

const CommentIcon = () => <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.5 9.7 9.7 0 01-4-.8L3 21l1.3-4.1A8.3 8.3 0 013 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z" /></svg>

export default function PostEngagementControls({ post, divider = false, compact = false }: { post: EngagementPost; divider?: boolean; compact?: boolean }) {
  const { loggedIn, signIn } = useAuth()
  const likeMutation = usePostLike(post.id)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const commentsId = useId()

  return <>
    <div className={`relative z-10 ml-auto flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-2'} text-[12px] tabular-nums text-[var(--color-text-secondary)]`}>
      <AppreciationButton compact={compact} isLiked={post.isLiked} count={post.likesCount} label={`${post.isLiked ? 'Remove appreciation from' : 'Appreciate'} ${post.title}`} disabled={likeMutation.isPending} onClick={() => loggedIn ? likeMutation.mutate(!post.isLiked) : signIn()} />
      {divider && <span aria-hidden="true" className="h-5 w-px bg-[var(--color-border)]" />}
      <button data-button-style="action" type="button" aria-label={`Comments on ${post.title}`} aria-haspopup="dialog" aria-expanded={commentsOpen} aria-controls={commentsOpen ? commentsId : undefined} onClick={() => setCommentsOpen(true)} className={`flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${compact ? 'gap-1 px-1' : 'min-w-11 gap-1.5 px-2.5'}`}>
        <CommentIcon /><span>{post.commentsCount || 0}</span>
      </button>
    </div>
    {commentsOpen && <CommentsModal id={commentsId} postId={post.id} title={post.title} initialCount={post.commentsCount || 0} onClose={() => setCommentsOpen(false)} />}
  </>
}
