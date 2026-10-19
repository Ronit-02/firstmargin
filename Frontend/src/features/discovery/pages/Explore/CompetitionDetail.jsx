import Select from '@/shared/components/ui/Select'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import retainRetryView from '@/shared/utils/retainRetryView'
import CompetitionEntryCard from '@/features/discovery/components/CompetitionEntryCard'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import { useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import CompetitionImage from '@/features/competition/components/CompetitionImage'
import competitionTypeLabel from '@/features/competition/utils/competitionTypeLabel'
import useAuth from '@/features/auth/hooks/useAuth'
import { useCompetition, useEligiblePosts, useEntryVote, useSubmitEntry } from '@/features/competition/hooks/useCompetitions'
import { ListSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import MissingResourceState from '@/shared/components/ui/MissingResourceState'
import isMissingResourceError from '@/shared/errors/isMissingResourceError'
import PageFrame from '@/shared/components/layout/PageFrame'
import useDialogFocus from '@/shared/hooks/useDialogFocus'

const date = value => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be announced'

function EnterModal({ competitionId, onClose }) {
  const closeButtonRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeButtonRef)
  const posts = useEligiblePosts(competitionId, true)
  const submit = useSubmitEntry(competitionId)
  const [postId, setPostId] = useState('')
  const [note, setNote] = useState('')
  const enter = event => {
    event.preventDefault()
    if (!postId || submit.isPending) return
    submit.mutate({ postId, note }, { onSuccess: onClose })
  }
  return <ModalLayer onDismiss={onClose} aria-labelledby="entry-title" className="grid place-items-center p-4"><section ref={dialogRef} tabIndex={-1} className="w-full max-w-[520px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><ModalHeader title="Submit a story" titleId="entry-title" onClose={onClose} closeLabel="Close" closeRef={closeButtonRef} className="-mx-6 -mt-6" /><form className="mt-6" onSubmit={enter}><Select id="entry-post" label="Your published story" value={postId} options={[{ value: '', label: 'Choose a story' }, ...(posts.data || []).map(post => ({ value: post.id, label: post.title }))]} onChange={setPostId} className="max-w-none" required describedBy="entry-post-help" /><p id="entry-post-help" className="mt-1 text-[11px] text-[var(--color-text-muted)]">Choose one of your published stories that follows the competition rules.</p><label className="block mt-4 mb-2 text-[12px] font-semibold text-[var(--color-text)]" htmlFor="entry-note">Author note <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label><textarea id="entry-note" value={note} maxLength={500} aria-describedby="entry-note-help" onChange={event => setNote(event.target.value)} className="w-full min-h-20 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)]" /><p id="entry-note-help" className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">{note.length}/500 characters</p>{submit.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{submit.error?.response?.data?.message || 'Entry could not be submitted.'}</p>}<div className="mt-5 flex justify-end gap-2"><Button type="submit" disabled={!postId || submit.isPending} aria-busy={submit.isPending}>{'Submit entry'}</Button></div></form></section></ModalLayer>
}

export default function CompetitionDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { loggedIn, signIn } = useAuth()
  const query = retainRetryView(useCompetition(id))
  const vote = useEntryVote(id)
  const [showEntry, setShowEntry] = useState(false)
  if (query.isPending) return <PageFrame><div role="status" aria-label="Loading competition"><Skeleton className="h-8 w-20 rounded-full" /><Skeleton className="mt-7 h-[clamp(180px,30vw,300px)] w-full rounded-[20px]" /><Skeleton className="mt-7 h-10 w-3/5" /><Skeleton className="mt-4 h-4 w-full max-w-2xl" /><div className="mt-10"><ListSkeleton count={4} role={undefined} /></div></div></PageFrame>
  if (query.isError && isMissingResourceError(query.error)) return <MissingResourceState eyebrow="Competition unavailable" title="This competition is no longer available" detail="It may have been removed or the link may be incorrect. Explore current competitions instead." recoveryTo="/explore/competitions" recoveryLabel="Explore competitions" />
  if (query.isError) return <PageFrame><div role="alert"><p className="text-[13px] text-[var(--color-danger)]">Competition could not be loaded.</p><Button className="mt-4" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div></PageFrame>
  const competition = query.data
  const canEnter = competition.status === 'open' && !competition.isEntered
  return <PageFrame>
    <div className="mb-7"><CompetitionImage src={competition.coverImage} title={competition.title} status={competition.status} height="clamp(180px, 30vw, 300px)" radius="20px" /></div>
    <div className="flex flex-wrap gap-2 text-[11px] text-[var(--color-text-secondary)]"><span className="rounded-full bg-[var(--color-bg-alt)] px-2.5 py-1 font-semibold uppercase">{competition.status}</span><span className="rounded-full bg-[var(--color-bg-alt)] px-2.5 py-1">{competitionTypeLabel(competition)}</span><span className="rounded-full bg-[var(--color-bg-alt)] px-2.5 py-1">Voting closes {date(competition.closeDate)}</span><span className="rounded-full bg-[var(--color-bg-alt)] px-2.5 py-1">{competition.entriesCount} entries</span></div>
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6"><h1 className="min-w-0 text-[clamp(30px,5vw,48px)] font-bold leading-[1.05] tracking-[-0.045em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{competition.title}</h1><div className="flex shrink-0 flex-col items-end gap-2"><Button variant={canEnter ? 'primary' : 'secondary'} disabled={!canEnter} onClick={() => loggedIn ? setShowEntry(true) : signIn()}>{competition.isEntered ? 'Entry submitted' : competition.status === 'open' ? 'Add your entry' : 'Entries closed'}</Button>{competition.isEntered && <span className="text-right text-[12px] text-[var(--color-text-secondary)]">You have already added an entry for this competition.</span>}</div></div>
    <p className="mt-4 max-w-[760px] text-[14px] leading-7 text-[var(--color-text-secondary)]">{competition.description}</p>
    {(competition.rules?.length > 0 || competition.prizes?.length > 0) && <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)] md:items-start">{competition.rules?.length > 0 && <section className="max-w-[760px]"><h2 className="text-[18px] font-bold text-[var(--color-text)]">Rules</h2><ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{competition.rules.map((rule, index) => <li key={`${rule}-${index}`} className="flex gap-3"><span className="text-[var(--color-accent)]">{String(index + 1).padStart(2, '0')}</span><span>{rule}</span></li>)}</ul></section>}{competition.prizes?.length > 0 && <section><h2 className="text-[18px] font-bold text-[var(--color-text)]">Prizes</h2><div className="mt-3 flex flex-wrap gap-3">{competition.prizes.map(prize => <div key={`${prize.rank}-${prize.amount}`} className="min-w-32 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3"><p className="text-[12px] font-semibold text-[var(--color-text)]">{prize.rank}</p><p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{prize.amount}</p></div>)}</div></section>}</div>}
    <section className="mt-12 border-t border-[var(--color-border)] pt-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-[22px] font-bold text-[var(--color-text)]">Entries</h2><p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Reader voting is {competition.status === 'open' ? 'open' : 'closed'}. Each signed-in reader gets one active vote per competition and can change it until voting closes.</p>{competition.competitionType === 'collective_choice' && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">After voting closes, the fixed moderator roster scores every eligible entry. Reader votes and judge scores each count 50%.</p>}<span className="mt-1 block text-[12px] text-[var(--color-text-muted)]">{competition.entries.length} submitted</span>{competition.noWinnerReason && <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">Closed with no winner.</p>}</div></div><div className="card-grid card-grid--post competition-entry-grid items-start gap-6 sm:gap-4">{competition.entries.map(entry => <CompetitionEntryCard key={entry.id} entry={entry} status={competition.status === 'open' ? 'open' : 'closed'} voting={vote.isPending} from={location.pathname} onVote={() => loggedIn ? vote.mutate({ entryId: entry.id, isVoted: !entry.isVoted }) : signIn()} />)}</div>{competition.entries.length === 0 && <p className="py-10 text-[13px] text-[var(--color-text-muted)]">No entries yet.</p>}</section>
    {showEntry && <EnterModal competitionId={id} onClose={() => setShowEntry(false)} />}
  </PageFrame>
}
