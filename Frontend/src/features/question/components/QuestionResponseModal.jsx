import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { fetchMyPosts } from '@/features/user/api/profile'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import Select from '@/shared/components/ui/Select'
import Button from '@/shared/components/ui/Button'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { useLinkQuestionResponse, useQuestionAnswer } from '../hooks/useQuestions'

export default function QuestionResponseModal({ questionId, onClose }) {
  const closeRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeRef)
  const viewer = useSelector(state => state.auth.user)
  const [mode, setMode] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const posts = useQuery({ queryKey: ['question-response-posts', viewer], queryFn: async () => {
    const records = await fetchMyPosts()
    const now = Date.now()
    return records.filter(post => post.publicationStatus !== 'unpublished' && (!post.publicAt || new Date(post.publicAt).getTime() <= now))
  }, enabled: mode === 'story' })
  const link = useLinkQuestionResponse(questionId)
  const answer = useQuestionAnswer(questionId)
  const [postId, setPostId] = useState('')
  const availablePosts = posts.data || []
  const attach = event => {
    event.preventDefault()
    if (!postId || link.isPending) return
    link.mutate(postId, { onSuccess: onClose })
  }
  const submitAnswer = event => {
    event.preventDefault()
    const text = answerText.trim()
    if (text.length < 10 || text.length > 1000 || answer.isPending) return
    answer.mutate({ questionId, text }, { onSuccess: onClose })
  }

  return <ModalLayer onDismiss={onClose} aria-labelledby="question-response-title" className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="max-h-[calc(var(--overlay-height)-2rem)] w-full max-w-[540px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
      <ModalHeader title="Add a response" titleId="question-response-title" subtitle="Choose a short answer or a story response for this question." onClose={onClose} closeLabel="Close response choices" closeRef={closeRef} className="-mx-6 -mt-6" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" aria-pressed={mode === 'answer'} onClick={() => setMode('answer')} className={`button-target min-h-11 rounded-[12px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${mode === 'answer' ? 'border-[var(--color-accent)] bg-[var(--color-bg-alt)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-alt)]'}`}><span className="block text-[14px] font-semibold text-[var(--color-text)]">Short answer</span><span className="mt-1 block text-[12px] text-[var(--color-text-secondary)]">Write a direct answer here.</span></button>
        <button type="button" aria-pressed={mode === 'story'} onClick={() => setMode('story')} className={`button-target min-h-11 rounded-[12px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${mode === 'story' ? 'border-[var(--color-accent)] bg-[var(--color-bg-alt)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-alt)]'}`}><span className="block text-[14px] font-semibold text-[var(--color-text)]">Story response</span><span className="mt-1 block text-[12px] text-[var(--color-text-secondary)]">Attach or write a published story.</span></button>
      </div>
      {mode === 'answer' && <form className="mt-6" onSubmit={submitAnswer}><label htmlFor="question-short-answer" className="block text-[12px] font-semibold text-[var(--color-text)]">Your answer</label><textarea id="question-short-answer" value={answerText} onChange={event => setAnswerText(event.target.value)} minLength={10} maxLength={1000} required rows={5} className="mt-2 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[14px] leading-6 text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]" />{answer.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{answer.error?.response?.data?.message || 'The answer could not be posted.'}</p>}<Button type="submit" className="mt-4" disabled={answerText.trim().length < 10 || answer.isPending} aria-busy={answer.isPending}>Post answer</Button></form>}
      {mode === 'story' && <><form className="mt-6" onSubmit={attach}>
        {posts.isPending ? <p role="status" className="text-[13px] text-[var(--color-text-secondary)]">Loading your published stories…</p> : posts.isError ? <div role="alert"><p className="text-[13px] text-[var(--color-danger)]">Your stories could not be loaded.</p><Button type="button" variant="secondary" className="mt-3" onClick={() => posts.refetch()} disabled={posts.isFetching} aria-busy={posts.isFetching}>Try again</Button></div> : availablePosts.length ? <><Select id="response-post" label="Your published story" value={postId} options={[{ value: '', label: 'Choose a story' }, ...availablePosts.map(post => ({ value: post._id || post.id, label: post.title }))]} onChange={setPostId} className="max-w-none" required /><Button type="submit" className="mt-4" disabled={!postId || link.isPending} aria-busy={link.isPending}>Attach story</Button></> : <p className="text-[13px] text-[var(--color-text-secondary)]">You have no published stories to attach yet.</p>}
        {link.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{link.error?.response?.data?.message || 'The story could not be attached.'}</p>}
      </form>
      <div className="mt-6 border-t border-[var(--color-border)] pt-5"><p className="text-[13px] text-[var(--color-text-secondary)]">Have a new response in mind?</p><Link to={`/studio?question=${questionId}`} onClick={onClose} className="button-target mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-[18px] text-[13px] font-medium text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">Write a new story</Link></div></>}
    </section>
  </ModalLayer>
}
