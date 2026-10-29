import Select from '@/shared/components/ui/Select'
import retainRetryView from '@/shared/utils/retainRetryView'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import ReportModal, { reportTitle } from '@/shared/components/ui/ReportModal'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAnswerReport, useAnswerUpvote, useQuestion, useQuestionFollow, useQuestionReport, useQuestionUpvote } from '@/features/question/hooks/useQuestions'
import QuestionResponseModal from '@/features/question/components/QuestionResponseModal'
import useAuth from '@/features/auth/hooks/useAuth'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'
import Tag from '@/shared/components/ui/Tag'
import Button from '@/shared/components/ui/Button'
import PageFrame from '@/shared/components/layout/PageFrame'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import MissingResourceState from '@/shared/components/ui/MissingResourceState'
import isMissingResourceError from '@/shared/errors/isMissingResourceError'

const REPORT_REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['hate', 'Hateful content'],
  ['misinformation', 'Misinformation'],
  ['other', 'Other'],
]

const FlagIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 21V3h14l-3 5 3 5H5" /></svg>

function AnswerReportForm({ questionId, answerId }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const report = useAnswerReport()
  const submit = event => { event.preventDefault(); report.mutate({ questionId, answerId, reason, details }) }
  if (report.isSuccess) return <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">Thanks. Your answer report was sent for review.</p>
  return <form onSubmit={submit} className="max-w-[520px]">
    <Select id={`answer-report-reason-${answerId}`} label="Reason" value={reason} options={REPORT_REASONS.map(([value, label]) => ({ value, label }))} onChange={setReason} className="max-w-none" />
    <label htmlFor={`answer-report-details-${answerId}`} className="mt-3 block text-[11px] font-semibold text-[var(--color-text)]">Details <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label>
    <textarea id={`answer-report-details-${answerId}`} value={details} maxLength={1000} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-20 w-full rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[12px] text-[var(--color-text)]" />
    {report.isError && <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">{report.error?.response?.data?.message || 'The report could not be submitted.'}</p>}
    <Button type="submit" className="mt-3" disabled={report.isPending} aria-busy={report.isPending}>{'Submit report'}</Button>
  </form>
}

function Answer({ answer, questionId }) {
  const { loggedIn, signIn } = useAuth()
  const vote = useAnswerUpvote(questionId)
  const [reportOpen, setReportOpen] = useState(false)
  const toggleVote = () => loggedIn ? vote.mutate({ questionId, answerId: answer.id, isUpvoted: !answer.isUpvoted }) : signIn()
  return <article className="border-t border-[var(--color-border)] py-5 first:border-t-0">
    <AuthorMeta author={answer.author} date={answer.createdAt} size="sm" />
    <p className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-[var(--color-text)]">{answer.text}</p>
    <button data-button-style="action" type="button" onClick={toggleVote} disabled={vote.isPending} aria-pressed={answer.isUpvoted} aria-label={`${answer.isUpvoted ? 'Remove upvote from' : 'Upvote'} answer`} className="button-target mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-3 text-[12px] text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2" aria-busy={vote.isPending}>
      <span data-button-icon aria-hidden="true">▲</span>{answer.upvotesCount}
    </button>
    <button type="button" aria-haspopup="dialog" onClick={() => loggedIn ? setReportOpen(true) : signIn()} className="button-target ml-2 inline-flex min-h-11 items-center rounded-full px-3 text-[12px] text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">{reportTitle('answer')}</button>
    {reportOpen && <ReportModal title={reportTitle('answer')} onClose={() => setReportOpen(false)}><AnswerReportForm questionId={questionId} answerId={answer.id} /></ReportModal>}
  </article>
}

function ReportForm({ questionId }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const report = useQuestionReport(questionId)
  const submit = event => { event.preventDefault(); report.mutate({ questionId, reason, details }) }
  if (report.isSuccess) return <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">Thanks. Your report was sent for review.</p>
  return <form onSubmit={submit} className="max-w-[520px]">
    <Select id="question-report-reason" label="Reason" value={reason} options={REPORT_REASONS.map(([value, label]) => ({ value, label }))} onChange={setReason} className="max-w-none" />
    <label htmlFor="question-report-details" className="mt-3 block text-[11px] font-semibold text-[var(--color-text)]">Details <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label>
    <textarea id="question-report-details" value={details} maxLength={1000} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-20 w-full rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[12px] text-[var(--color-text)]" />
    {report.isError && <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">{report.error?.response?.data?.message || 'The report could not be submitted.'}</p>}
    <Button type="submit" className="mt-3" disabled={report.isPending} aria-busy={report.isPending}>{'Submit report'}</Button>
  </form>
}

export default function QuestionDetail() {
  const { id } = useParams()
  const { hash, pathname, search } = useLocation()
  const navigate = useNavigate()
  const { loggedIn, signIn } = useAuth()
  const question = retainRetryView(useQuestion(id))
  const follow = useQuestionFollow(id)
  const upvote = useQuestionUpvote('hot')
  const [responseOpen, setResponseOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const requestedTab = new URLSearchParams(search).get('questionTab')
  const activeTab = hash === '#response-posts-title' || hash === '#response-shorts-title' || requestedTab === 'responses' ? 'responses' : 'answers'
  const setTab = tab => {
    const params = new URLSearchParams(search)
    if (tab === 'answers') params.delete('questionTab')
    else params.set('questionTab', 'responses')
    navigate({ pathname, search: params.toString() ? `?${params}` : '', hash: '' })
  }
  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'answers' : event.key === 'End' ? 'responses' : activeTab === 'answers' ? 'responses' : 'answers'
    setTab(next)
    requestAnimationFrame(() => document.getElementById(`question-tab-${next}`)?.focus())
  }

  useEffect(() => {
    if (!['#response-posts-title', '#response-shorts-title'].includes(hash) || !question.data?.responsePosts.length) return undefined
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const heading = document.getElementById(hash === '#response-shorts-title' ? 'response-posts-title' : hash.slice(1))
        heading?.scrollIntoView({ block: 'start', behavior: 'auto' })
        heading?.focus({ preventScroll: true })
      })
    })
    return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame) }
  }, [hash, question.data])

  if (question.isPending) return <PageFrame><ListSkeleton count={4} label="Loading question" /></PageFrame>
  if (question.isError && isMissingResourceError(question.error)) return <MissingResourceState eyebrow="Question unavailable" title="This question is no longer available" detail="It may have been removed or the link may be incorrect. Explore current reader questions instead." recoveryTo="/explore/questions" recoveryLabel="Explore questions" />
  if (question.isError) return <PageFrame><div><p role="alert" className="text-[13px] text-[var(--color-danger)]">This question could not be loaded.</p><Button variant="secondary" className="mt-4" onClick={() => question.refetch()} aria-busy={question.isFetching} disabled={question.isFetching}>Try again</Button></div></PageFrame>
  const item = question.data
  return <PageFrame>
    <div>
      <article>
        <AuthorMeta author={item.author} date={item.createdAt} size="sm" />
        <h1 className="mt-4 min-w-0 break-words text-[clamp(1.7rem,4vw,2.7rem)] leading-[1.12] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{item.text}</h1>
        {item.context && <p className="mt-4 min-w-0 break-words text-[15px] leading-7 text-[var(--color-text-secondary)]">{item.context}</p>}
        <div className="mt-4 flex flex-wrap gap-x-2">{item.tags.map(tag => <Link key={tag} to={`/search?${new URLSearchParams({ q: tag.trim(), type: 'questions' })}`} aria-label={`Questions about ${tag}`} className="inline-flex min-h-11 max-w-full items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] [&>span]:max-w-full [&>span]:break-words [&>span]:whitespace-normal"><Tag label={`#${tag}`} /></Link>)}</div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => loggedIn ? setResponseOpen(true) : signIn()}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Add a response</Button>
          <button data-button-style="action" data-button-boundary="true" type="button" onClick={() => loggedIn ? upvote.mutate({ questionId: id, isUpvoted: !item.isUpvoted }) : signIn()} disabled={upvote.isPending} aria-label={`${item.isUpvoted ? 'Remove upvote from' : 'Upvote'} question`} aria-pressed={item.isUpvoted} className="button-target inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-[12px] font-semibold text-[var(--color-text)]" aria-busy={upvote.isPending}><span data-button-icon aria-hidden="true">▲</span> {item.upvotesCount}</button>
          <button data-button-style="action" type="button" onClick={() => loggedIn ? follow.mutate({ questionId: id, isFollowing: !item.isFollowing }) : signIn()} disabled={follow.isPending} aria-busy={follow.isPending} aria-pressed={Boolean(item.isFollowing)} aria-label={item.isFollowing ? 'Unfollow question' : 'Follow question'} className={`button-target inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-[12px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 disabled:opacity-60 ${item.isFollowing ? 'bg-[var(--color-accent)] text-[var(--color-text-inverted)] hover:bg-[var(--color-accent-hover)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)]'}`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={item.isFollowing ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg><span>{item.followersCount ?? 0}</span></button>
          <Button variant="ghost" leadingIcon={<FlagIcon />} aria-label={reportTitle('question')} aria-haspopup="dialog" onClick={() => loggedIn ? setReportOpen(true) : signIn()}>Report</Button>
        </div>
        {reportOpen && <ReportModal title={reportTitle('question')} onClose={() => setReportOpen(false)}><ReportForm questionId={id} /></ReportModal>}
      </article>
      <div role="tablist" aria-label="Question responses" className="mt-12 flex gap-2 border-b border-[var(--color-border)]">
        {[['answers', `Answers (${item.answers.length})`], ['responses', `Story responses (${item.responsePosts.length})`]].map(([tab, label]) => <button key={tab} id={`question-tab-${tab}`} type="button" role="tab" aria-controls="question-tabpanel" aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setTab(tab)} onKeyDown={handleTabKeyDown} className={`button-target min-h-11 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${activeTab === tab ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{label}</button>)}
      </div>
      <section id="question-tabpanel" role="tabpanel" aria-labelledby={`question-tab-${activeTab}`} className="min-w-0 pt-6">
        {activeTab === 'answers' ? <>
          <h2 id="answers-title" className="text-[20px] font-bold text-[var(--color-text)]">Answers</h2>
          {item.answers.length ? <div className="mt-4">{item.answers.map(answerItem => <Answer key={answerItem.id} answer={answerItem} questionId={id} />)}</div> : <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">No short answers yet. Add useful context for the writers who find this request.</p>}
        </> : <>
          <h2 id="response-posts-title" tabIndex={-1} className="scroll-mt-6 text-[20px] font-bold text-[var(--color-text)] outline-none">Published story responses</h2>
          {item.responsePosts.length ? <div className="mt-4">{item.responsePosts.map(post => <DiscoveryPostCard key={post.id || post._id} post={{ ...post, id: post.id || post._id, image: post.image || post.coverImage }} comfortable />)}</div> : <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">No story responses yet.</p>}
        </>}
      </section>
      {responseOpen && <QuestionResponseModal questionId={id} onClose={() => setResponseOpen(false)} />}
    </div>
  </PageFrame>
}
