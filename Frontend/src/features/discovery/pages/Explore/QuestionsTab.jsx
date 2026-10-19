import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import retainRetryView from '@/shared/utils/retainRetryView'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import { useDeferredValue, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'
import Tag from '@/shared/components/ui/Tag'
import Button from '@/shared/components/ui/Button'
import useAuth from '@/features/auth/hooks/useAuth'
import { useCreateQuestion, useQuestions, useQuestionSuggestions, useQuestionUpvote } from '@/features/question/hooks/useQuestions'
import PageHeader from '@/shared/components/ui/PageHeader'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import FilterBar from '@/shared/components/ui/FilterBar'
import { tagFilterOptions } from '@/shared/utils/availableFilterOptions'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { searchDiscovery } from '@/features/discovery/api/search'
import QuestionResponseModal from '@/features/question/components/QuestionResponseModal'
import TagPicker from '@/features/editor/components/TagPicker'
import useFittingPills from '@/shared/hooks/useFittingPills'

const responseButtonClass = 'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[10px] border px-3 py-2 text-[12px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2'

export function QuestionCard({ question, sort = 'hot' }) {
  const categoryPath = tag => `/search?${new URLSearchParams({ q: tag.trim(), type: 'questions' })}`
  const { containerRef: tagsRef, visibleCount: visibleTags } = useFittingPills(question.tags)
  const { loggedIn, signIn } = useAuth()
  const vote = useQuestionUpvote(sort)
  const [responseOpen, setResponseOpen] = useState(false)
  const toggleVote = () => loggedIn
    ? vote.mutate({ questionId: question.id, isUpvoted: !question.isUpvoted })
    : signIn()

  return (
    <article className="relative py-6 max-md:py-9 border-b border-[var(--color-border)]">
      <div className="mb-5 pr-16">
        <div className="relative z-10 min-w-0 flex-1 [&>div]:gap-2 [&>div>div]:flex-wrap [&_a]:min-w-0 [&_a]:max-w-full [&_a]:after:absolute [&_a]:after:inset-0 [&_a]:after:content-[''] [&_a>span]:min-w-0 [&_a>span]:break-words">
          <AuthorMeta author={question.author} date={question.createdAt} size="sm" stacked />
        </div>
        <button data-button-style="action" data-button-boundary="true" type="button" onClick={toggleVote} disabled={vote.isPending} aria-pressed={question.isUpvoted} aria-label={`${question.isUpvoted ? 'Remove upvote from' : 'Upvote'} question`} title={question.isUpvoted ? 'Remove your upvote' : 'Upvote question'}
          className={`absolute right-0 top-6 max-md:top-9 z-10 min-h-11 min-w-12 px-2 py-2 rounded-[12px] border text-center disabled:opacity-50 ${question.isUpvoted ? 'bg-[var(--color-accent)] text-[var(--color-text-inverted)] border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`} aria-busy={vote.isPending}>
          <span data-button-icon aria-hidden="true" className="block text-[11px]">▲</span><span className="block text-[12px] font-semibold tabular-nums">{question.upvotesCount}</span>
        </button>
      </div>
      <h2 className="min-w-0 line-clamp-3 break-words text-[18px] leading-[1.35] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
        <Link to={`/explore/questions/${question.id}`} className="rounded-[4px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">{question.text}</Link>
      </h2>
      {question.context && <p className="mt-4 break-words text-[14px] leading-6 text-[var(--color-text-secondary)] line-clamp-2">{question.context}</p>}
      {question.tags.length > 0 && <div ref={tagsRef} className="mt-3 flex min-w-0 flex-nowrap gap-x-2 overflow-hidden">{question.tags.map((tag, index) => <Link key={tag} to={categoryPath(tag)} aria-label={`Questions about ${tag}`} aria-hidden={index >= visibleTags} className={`relative z-10 inline-flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${index >= visibleTags ? 'invisible' : ''}`}><Tag label={`#${tag}`} /></Link>)}</div>}
      <div className="mt-5 flex flex-col items-start gap-4 text-[13px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="text-[var(--color-text-secondary)]"><strong className="font-semibold text-[var(--color-text)]">{question.answersCount}</strong> {question.answersCount === 1 ? 'short answer' : 'short answers'} · <strong className="font-semibold text-[var(--color-text)]">{question.responsePosts.length}</strong> {question.responsePosts.length === 1 ? 'story response' : 'story responses'}</span>
        <div className="relative z-10 flex items-center gap-2">
          <button type="button" aria-haspopup="dialog" onClick={() => loggedIn ? setResponseOpen(true) : signIn()} className={`button-target ${responseButtonClass} border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-inverted)]`}><span className="text-[var(--color-text-inverted)]">Add response</span></button>
          {question.responsePosts.length > 0 && <Link to={`/explore/questions/${question.id}#response-posts-title`} className={`${responseButtonClass} border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)]`}>View responses</Link>}
        </div>
      </div>
      {responseOpen && <QuestionResponseModal questionId={question.id} onClose={() => setResponseOpen(false)} />}
    </article>
  )
}

function AskModal({ onClose }) {
  const closeButtonRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeButtonRef)
  const [text, setText] = useState('')
  const [context, setContext] = useState('')
  const [tags, setTags] = useState([])
  const [targetWriterText, setTargetWriterText] = useState('')
  const [targetWriters, setTargetWriters] = useState([])
  const deferredText = useDeferredValue(text)
  const deferredTargetWriterText = useDeferredValue(targetWriterText)
  const suggestions = useQuestionSuggestions(deferredText)
  const writerSuggestions = useQuery({
    queryKey: ['question-target-writers', deferredTargetWriterText.trim()],
    queryFn: () => searchDiscovery({ query: deferredTargetWriterText.trim(), type: 'writers', limit: 5 }),
    enabled: deferredTargetWriterText.trim().length >= 2,
    staleTime: 30_000,
  })
  const create = useCreateQuestion()

  const submit = event => {
    event?.preventDefault()
    create.mutate({
    text,
    context,
    tags,
    targetWriterIds: targetWriters.map(writer => writer.id),
    })
  }

  return <ModalLayer onDismiss={onClose} aria-labelledby="ask-title" className="flex items-center justify-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[560px] max-h-[calc(var(--overlay-height)-2rem)] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
      <ModalHeader title="Ask the community" titleId="ask-title" onClose={onClose} closeLabel="Close" closeRef={closeButtonRef} className="-mx-6 -mt-6" />
      {create.isSuccess ? <div className="py-8"><h3 className="text-[17px] font-semibold text-[var(--color-text)]">{create.data.mergedExisting ? 'Your upvote was added to the existing question.' : 'Your question is now open to writers.'}</h3><Button className="mt-5" onClick={onClose}>Done</Button></div> : <form onSubmit={submit}>
        <label htmlFor="question-text" className="block mt-6 mb-2 text-[12px] font-semibold text-[var(--color-text)]">Question</label>
        <textarea id="question-text" value={text} minLength={10} maxLength={180} required onChange={event => setText(event.target.value)} placeholder="What would you like a writer to explore?" className="w-full min-h-24 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[14px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
        {suggestions.data?.length > 0 && <div className="mt-3 rounded-[12px] border border-[var(--color-border)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Similar questions</p>{suggestions.data.map(item => <button key={item.id} type="button" onClick={() => setText(item.text)} className="button-target block w-full py-2 text-left text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">{item.text} · {item.upvotesCount} upvotes {item.exact ? '· exact match' : ''}</button>)}</div>}
        <label htmlFor="question-context" className="block mt-6 mb-2 text-[12px] font-semibold text-[var(--color-text)]">Context <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label>
        <textarea id="question-context" value={context} maxLength={1000} onChange={event => setContext(event.target.value)} className="w-full min-h-20 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
        <div className="mt-6"><TagPicker tags={tags} onChange={setTags} idPrefix="question-tag" limit={5} maxTagLength={30} required={false} /></div>
        <label htmlFor="question-target-writers" className="block mt-6 mb-2 text-[12px] font-semibold text-[var(--color-text)]">Target writers <span className="font-normal text-[var(--color-text-muted)]">(optional, up to five)</span></label>
        <input id="question-target-writers" value={targetWriterText} onChange={event => setTargetWriterText(event.target.value)} placeholder="Search by writer name or handle" className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
        {targetWriters.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{targetWriters.map(writer => <button key={writer.id} type="button" onClick={() => setTargetWriters(current => current.filter(item => item.id !== writer.id))} className="button-target min-h-11 rounded-full bg-[var(--color-text)] px-3 text-[11px] text-[var(--color-text-inverted)]">{writer.displayName} ×</button>)}</div>}
        {writerSuggestions.data?.data?.writers?.filter(writer => !targetWriters.some(selected => selected.id === writer.id)).length > 0 && <div className="mt-2 rounded-[12px] border border-[var(--color-border)] p-2">{writerSuggestions.data.data.writers.filter(writer => !targetWriters.some(selected => selected.id === writer.id)).map(writer => <button key={writer.id} type="button" disabled={targetWriters.length >= 5} onClick={() => { setTargetWriters(current => [...current, writer]); setTargetWriterText('') }} className="button-target block min-h-11 w-full rounded-[8px] px-2 text-left text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] disabled:opacity-50">{writer.displayName} <span className="text-[var(--color-text-muted)]">@{writer.handle}</span></button>)}</div>}
        {create.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{create.error?.response?.data?.message || 'The question could not be posted.'}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button type="submit" disabled={text.trim().length < 10 || create.isPending} aria-busy={create.isPending}>{'Post question'}</Button></div>
      </form>}
    </section>
  </ModalLayer>
}

export default function QuestionsTab() {
  const [params, setParams] = useSearchParams()
  const requestedSort = params.get('questionSort')
  const requestedTopic = params.get('questionTopic')
  const sort = ['hot', 'newest'].includes(requestedSort) ? requestedSort : 'hot'
  const [showAsk, setShowAsk] = useState(false)
  const { loggedIn, signIn } = useAuth()
  const query = retainRetryView(useQuestions(sort))
  const questions = query.data?.pages.flatMap(page => page.data) || []
  const topicOptions = tagFilterOptions(questions, requestedTopic?.trim().toLowerCase(), query.hasNextPage)
  const topic = topicOptions.some(option => option.id === requestedTopic?.trim().toLowerCase()) ? requestedTopic.trim().toLowerCase() : 'all'
  const filteredQuestions = topic === 'all' ? questions : questions.filter(question => (question.tags || []).some(tag => tag.trim().toLowerCase() === topic))

  const resetFilters = () => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.delete('questionTopic')
      next.delete('questionSort')
      return next
    })
  }
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
      return next
    })
  }

  return <div>
    <PageHeader eyebrow="Reader demand" title="What should writers explore next?" description="Ask for the story you wish existed. Duplicate requests become upvotes, helping writers see real demand." actions={<div className="flex flex-wrap items-center gap-3"><Button onClick={() => loggedIn ? setShowAsk(true) : signIn()}><span aria-hidden="true" className="mr-1 text-[17px] leading-none">+</span>Ask a question</Button>{questions.length > 0 && <FilterBar label="Topic" value={topic} onReset={resetFilters} onChange={value => updateFilter('questionTopic', value, 'all')} options={topicOptions} sortOptions={[{ id: 'hot', label: 'Most upvoted' }, { id: 'newest', label: 'Newest' }]} sortValue={sort} onSortChange={value => updateFilter('questionSort', value, 'hot')} />}</div>} />
    {query.isPending && <ListSkeleton count={4} label="Loading reader questions" />}
    {query.isError && <div role="alert" className="py-12 text-center"><p className="text-[13px] text-[var(--color-danger)]">Questions could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div>}
    {!query.isPending && !query.isError && filteredQuestions.length === 0 && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">No questions match this topic.</p>}
    {filteredQuestions.map(question => <QuestionCard key={question.id} question={question} sort={sort} />)}
    <InfiniteScrollSentinel query={query} className="pt-8" />
    {showAsk && <AskModal onClose={() => setShowAsk(false)} />}
  </div>
}
