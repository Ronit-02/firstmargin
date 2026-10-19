import retainRetryView from '@/shared/utils/retainRetryView'
import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '@/shared/components/ui/Button'
import Avatar from '@/shared/components/ui/Avatar'
import useAuth from '@/features/auth/hooks/useAuth'
import { createComment } from '../api/comments'
import CommentItem from '../components/CommentItem'
import useComments, { commentsKey } from '../hooks/useComments'
import { updatePostCaches } from '../hooks/postCache'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import useToast from '@/shared/hooks/useToast'

export default function CommentsSection({ postId, initialCount = 0, compact = false, collapsible = !compact, expanded: controlledExpanded, onExpandedChange, hideHeading = false }) {
  const [text, setText] = useState('')
  const commentInputRef = useRef(null)
  const [internalExpanded, setInternalExpanded] = useState(!collapsible)
  const expanded = controlledExpanded ?? internalExpanded
  const setExpanded = onExpandedChange || setInternalExpanded
  const inlineCompact = compact && collapsible
  const idPrefix = useId()
  const commentsHeadingId = `${idPrefix}-comments-heading`
  const commentInputId = `${idPrefix}-new-comment`
  const commentCountId = `${idPrefix}-comment-count`
  const queryClient = useQueryClient()
  const { loggedIn, signIn, user, avatarUrl } = useAuth()
  const commentsQuery = retainRetryView(useComments(postId, null, expanded))
  const { notify } = useToast()

  useLayoutEffect(() => {
    const input = commentInputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [text, expanded])

  const comments = commentsQuery.data?.pages.flatMap(page => page.data).filter(comment => !comment.isDeleted || comment.repliesCount > 0) || []
  const count = commentsQuery.data?.pages[0]?.meta.totalCount ?? Math.max(initialCount, comments.length)
  const commentsHeading = <h2 id={commentsHeadingId} className={`font-bold ${compact ? `text-[17px] ${collapsible ? 'mb-0' : 'mb-4'}` : 'text-[22px] mb-6'} text-[var(--color-text)]`}
    style={{ fontFamily: 'var(--font-display)' }}>
    {collapsible ? <Button variant="disclosure" flush data-comment-disclosure className={`!min-h-11 !px-0 !py-0 !font-bold ${compact ? '!text-[17px]' : '!text-[22px]'}`} style={{ fontFamily: 'var(--font-display)' }} aria-expanded={expanded} aria-controls={`${idPrefix}-comments-body`} onClick={() => setExpanded(value => !value)}>Comments ({count})</Button> : <>Comments ({count})</>}
  </h2>

  const commentMutation = useMutation({
    mutationFn: content => createComment({ postId, text: content }),
    onSuccess: comment => {
      queryClient.setQueryData(commentsKey(postId, user || 'anonymous'), previous => {
        if (!previous) return previous
        const [firstPage, ...remainingPages] = previous.pages
        return {
          ...previous,
          pages: [
            { ...firstPage, data: [comment, ...firstPage.data], meta: { ...firstPage.meta, ...(firstPage.meta.totalCount !== undefined ? { totalCount: firstPage.meta.totalCount + 1 } : {}) } },
            ...remainingPages,
          ],
        }
      })
      updatePostCaches(queryClient, postId, post => ({
        ...post,
        commentsCount: (post.commentsCount || 0) + 1,
      }))
      setText('')
      setExpanded(true)
      notify('Comment posted.')
    },
    onError: () => notify("We couldn't post your comment.", { tone: 'error' }),
  })

  const handleSubmit = event => {
    event?.preventDefault()
    const content = text.trim()
    if (!content || commentMutation.isPending) return
    commentMutation.mutate(content)
  }

  const commentField = <textarea
    ref={commentInputRef}
    id={commentInputId}
    rows={1}
    value={text}
    maxLength={1000}
    required
    aria-label={inlineCompact ? 'Add a comment' : undefined}
    aria-describedby={commentCountId}
    onChange={event => setText(event.target.value)}
    placeholder="Add your comment…"
    className={`min-h-[1.6em] resize-none overflow-hidden bg-transparent p-0 text-[14px] leading-[1.6] font-[inherit] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] !shadow-none ${inlineCompact ? 'mb-1 block w-full border-0 border-b border-solid border-[var(--color-border)] focus-visible:border-[var(--color-focus)] !outline-none' : 'block w-full border-none !outline-none'}`}
  />
  const composer = (
      <div data-comment-composer="true" className={inlineCompact ? 'mt-3 mb-3' : `rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-focus)] focus-within:ring-2 focus-within:ring-[var(--color-focus)]/15 ${compact ? 'p-2 mb-3' : 'p-3 mb-6'}`}>
        {loggedIn ? (
          <div className="flex items-start gap-3">
            {!compact && <Avatar name={user || 'You'} size={36} />}
            {inlineCompact && <Avatar src={avatarUrl} name={user || 'You'} size={32} />}
            <form className="min-w-0 flex-1" onSubmit={handleSubmit}>
              {!inlineCompact && <label htmlFor={commentInputId} className={`block font-semibold text-[var(--color-text)] ${compact ? 'mb-1 text-[12px]' : 'mb-1 text-[13px]'}`}>Add a comment</label>}
              {inlineCompact ? (
                <>
                  {commentField}
                  <div className="flex min-w-0 items-center justify-end gap-2">
                    <span id={commentCountId} className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-secondary)]">{text.length}/1000</span>
                    <div className="flex items-center gap-1">
                      {text.trim() && <Button size="sm" className="!min-h-9 !px-1.5" variant="ghost" onClick={() => setText('')} disabled={commentMutation.isPending}>Cancel</Button>}
                      <Button size="sm" className="!min-h-9 !px-1.5 !font-semibold" data-compact-comment-submit type="submit" variant="ghost" disabled={!text.trim() || commentMutation.isPending} aria-busy={commentMutation.isPending}>Comment</Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {commentField}
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                    <span id={commentCountId} className="text-[12px] tabular-nums text-[var(--color-text-secondary)]">{text.length}/1000</span>
                    <div className="ml-auto flex justify-end flex-wrap gap-2">
                      {text.trim() && <Button className="!min-h-11 !px-3" variant="ghost" onClick={() => setText('')} disabled={commentMutation.isPending}>Cancel</Button>}
                      <Button className="!min-h-11 !px-4" type="submit" variant="primary" disabled={!text.trim() || commentMutation.isPending} aria-busy={commentMutation.isPending}>Comment</Button>
                    </div>
                  </div>
                </>
              )}
              {commentMutation.isError && (
                <p role="alert" className="text-[12px] text-[var(--color-danger)] mt-2">
                  We couldn't post your comment. Please try again.
                </p>
              )}
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[13px] text-[var(--color-text-secondary)]">Sign in to join the conversation.</p>
            <Button className="!min-h-11" variant="primary" onClick={signIn}>Sign in</Button>
          </div>
        )}
      </div>
  )

  return (
    <section aria-labelledby={hideHeading ? undefined : commentsHeadingId} aria-label={hideHeading ? 'Comments' : undefined}>
      {compact && !hideHeading && commentsHeading}
      {!collapsible && composer}
      {!compact && !hideHeading && commentsHeading}

      <div id={`${idPrefix}-comments-body`} hidden={!expanded}>
      {collapsible && composer}
      {commentsQuery.isLoading && (
        <ListSkeleton count={3} label="Loading comments" />
      )}
      {commentsQuery.isError && (
        <div className="py-6">
          <p role="alert" className="text-[13px] text-[var(--color-danger)] mb-3">We couldn't load the comments.</p>
          <Button className="min-h-10 sm:min-h-0" variant="secondary" onClick={() => commentsQuery.refetch()} aria-busy={commentsQuery.isFetching} disabled={commentsQuery.isFetching}>Try again</Button>
        </div>
      )}
      {!commentsQuery.isLoading && !commentsQuery.isError && comments.length === 0 && (
        <p className="text-[13px] text-[var(--color-text-secondary)] py-6">No comments yet. Start the conversation.</p>
      )}
      {comments.map((comment, index) => <CommentItem key={comment.id} comment={comment} postId={postId} compact={compact} hideBottomBorder={collapsible && index === comments.length - 1} />)}

      <InfiniteScrollSentinel query={commentsQuery} disabled={!expanded} className="pt-6" label="Loading more comments" />
      </div>
    </section>
  )
}
