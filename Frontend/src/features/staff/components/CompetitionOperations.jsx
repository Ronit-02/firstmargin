import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '@/shared/components/ui/Button'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import { fetchCompetition } from '@/features/competition/api/competitions'
import competitionTypeLabel from '@/features/competition/utils/competitionTypeLabel'
import { scoreCompetitionEntry } from '../api/staff'

const inputClass = 'mt-1 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)]'
const emptyScore = { craft: '', originality: '', relevance: '', note: '' }
const labelFor = entry => entry.publication?.title || 'Untitled entry'
const idOf = value => String(value?.id || value?._id || value || '')

export default function CompetitionOperations({ isAdmin, actorId, initialCompetitionId }) {
  const queryClient = useQueryClient()
  const [activeEntryId, setActiveEntryId] = useState(null)
  const [activeScore, setActiveScore] = useState(null)
  const [form, setForm] = useState(emptyScore)
  const detail = useQuery({ queryKey: ['staff', 'competition', initialCompetitionId], queryFn: () => fetchCompetition(initialCompetitionId) })
  const competition = detail.data
  const entries = competition?.entries || []
  const selectedEntry = entries.find(entry => idOf(entry.id) === activeEntryId) || entries[0]
  const roster = competition?.judgeRoster || []
  const isCollective = competition?.competitionType === 'collective_choice'
  const isJudgeMode = isCollective || ['hybrid', 'judges'].includes(competition?.votingMode)
  const eligibleEntries = entries.filter(entry => entry.status === 'submitted')
  const completedSlots = eligibleEntries.reduce((count, entry) => count + entry.judgeScores.length, 0)
  const score = useMutation({
    mutationFn: scoreCompetitionEntry,
    onSuccess: () => {
      setActiveScore(null)
      setForm(emptyScore)
      queryClient.invalidateQueries({ queryKey: ['staff', 'competition', initialCompetitionId] })
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })

  if (detail.isPending) return <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Loading competition scores…</p>
  if (detail.isError) return <div role="alert"><p className="text-[13px] text-[var(--color-danger)]">Competition scores could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => detail.refetch()}>Try again</Button></div>

  const submitScore = event => {
    event.preventDefault()
    if (!selectedEntry || !activeScore || activeScore.entryId !== idOf(selectedEntry.id) || score.isPending) return
    score.mutate({ competitionId: competition.id, entryId: selectedEntry.id, moderatorId: activeScore.moderatorId, ...form })
  }
  const openScore = (moderatorId, label, recorded) => {
    score.reset()
    setForm(recorded ? { craft: String(recorded.craft), originality: String(recorded.originality), relevance: String(recorded.relevance), note: recorded.note || '' } : emptyScore)
    setActiveScore({ entryId: idOf(selectedEntry.id), moderatorId, label, isEdit: Boolean(recorded) })
  }
  const canScore = competition.status === 'judging' && selectedEntry?.status === 'submitted'

  return <div className="space-y-7">
    <header className="border-b border-[var(--color-border)] pb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent)]">Competition judging</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-[30px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{competition.title}</h1><p className="mt-2 text-[12px] text-[var(--color-text-muted)]">{competitionTypeLabel(competition)} · {competition.status} · Voting closes {new Date(competition.closeDate).toLocaleString()}</p></div><Link to={`/explore/competitions/${competition.id}`} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[12px] font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]">View competition</Link></div>
      <p className="mt-4 max-w-[70ch] text-[13px] text-[var(--color-text-secondary)]">{competition.status === 'judging' ? 'Review each entry and complete the available moderator scores. Results are announced automatically when judging is complete.' : competition.status === 'closed' ? 'Review the recorded scores and final results.' : 'Entries and scores appear here as the competition progresses.'}</p>
    </header>

    <section aria-label="Judging overview" className="grid gap-3 sm:grid-cols-3">
      <Metric label="Eligible entries" value={eligibleEntries.length} />
      <Metric label={isCollective ? 'Moderator roster' : 'Reader votes'} value={isCollective ? roster.length : eligibleEntries.reduce((count, entry) => count + entry.votesCount, 0)} />
      <Metric label={isCollective ? 'Scoring slots complete' : 'Recorded scores'} value={isCollective ? `${completedSlots} / ${eligibleEntries.length * roster.length}` : completedSlots} />
    </section>

    {competition.noWinnerReason && <p className="rounded-[12px] border border-[var(--color-border)] p-4 text-[13px] text-[var(--color-text-secondary)]">Closed without a winner: {competition.noWinnerReason.replaceAll('_', ' ')}</p>}
    {!entries.length ? <p className="rounded-[16px] border border-[var(--color-border)] p-8 text-center text-[13px] text-[var(--color-text-muted)]">No entries have been submitted.</p> : <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.8fr)]">
      <section aria-label="Competition entries" className="min-w-0"><h2 className="mb-3 text-[16px] font-semibold text-[var(--color-text)]">Entries</h2><div className="space-y-2">{entries.map((entry, index) => <button key={entry.id} type="button" onClick={() => { setActiveEntryId(idOf(entry.id)); setActiveScore(null) }} aria-current={idOf(selectedEntry?.id) === idOf(entry.id) ? 'true' : undefined} className={`w-full rounded-[14px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${idOf(selectedEntry?.id) === idOf(entry.id) ? 'border-[var(--color-accent)] bg-[var(--color-bg-alt)]' : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'}`}><span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Entry {index + 1}{entry.isWinner ? ' · Co-winner' : ''}{entry.status === 'disqualified' ? ' · Disqualified' : ''}</span><span className="mt-1 block font-semibold text-[var(--color-text)]">{labelFor(entry)}</span><span className="mt-2 block text-[11px] text-[var(--color-text-muted)]">{entry.author?.username || 'Unknown author'} · {entry.votesCount} reader votes{isCollective ? ` · ${entry.judgeScores.length}/${entry.status === 'submitted' ? roster.length : 0} scores` : ''}</span></button>)}</div></section>
      {selectedEntry && <section aria-labelledby="selected-entry-title" className="min-w-0 rounded-[16px] border border-[var(--color-border)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">{selectedEntry.status}{selectedEntry.isWinner ? ' · Winner' : ''}</p><h2 id="selected-entry-title" className="mt-2 text-[22px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{labelFor(selectedEntry)}</h2><p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{selectedEntry.author?.username || 'Unknown author'} · {selectedEntry.votesCount} reader votes{selectedEntry.rank ? ` · Rank ${selectedEntry.rank}` : ''}</p></div>{selectedEntry.publication?._id && <Link to={`/post/${selectedEntry.publication._id}`} className="text-[12px] font-semibold text-[var(--color-accent)] hover:underline">Read post</Link>}</div>
        {selectedEntry.disqualificationReason && <p className="mt-4 text-[12px] text-[var(--color-danger)]">Disqualified: {selectedEntry.disqualificationReason}</p>}
        {competition.status === 'closed' && selectedEntry.score !== null && selectedEntry.score !== undefined && <p className="mt-4 text-[12px] text-[var(--color-text-secondary)]">Final score: {Number(selectedEntry.score).toFixed(2)}{isJudgeMode ? ` · Judge average: ${Number(selectedEntry.judgeScore).toFixed(2)}` : ''}</p>}
        <div className="mt-6 border-t border-[var(--color-border)] pt-5"><h3 className="text-[16px] font-semibold text-[var(--color-text)]">Moderator scores</h3><p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{isCollective ? 'Each roster moderator has one scoring slot for this entry.' : isJudgeMode ? 'Scores recorded for this entry.' : 'This competition is decided by reader votes.'}</p></div>
        {isCollective ? <div className="mt-4 space-y-3">{roster.map(moderator => { const moderatorId = idOf(moderator); const recorded = selectedEntry.judgeScores.find(item => idOf(item.judgeId) === moderatorId); const label = moderator.username || 'Moderator'; const actionLabel = canScore && (recorded ? isAdmin ? 'Edit score' : null : isAdmin ? 'Add missing score' : moderatorId === idOf(actorId) ? 'Add score' : null); return <ScoreRow key={moderatorId} label={label} recorded={recorded} actionLabel={actionLabel} onOpen={() => openScore(moderatorId, label, recorded)} /> })}{!roster.length && <p className="text-[12px] text-[var(--color-text-muted)]">No moderators were on the roster when judging began.</p>}</div> : isJudgeMode ? <div className="mt-4 space-y-3">{selectedEntry.judgeScores.map(item => { const moderatorId = idOf(item.judgeId); const label = item.moderatorName || 'Moderator'; return <ScoreRow key={moderatorId} label={label} recorded={item} actionLabel={canScore && (isAdmin || moderatorId === idOf(actorId)) ? 'Edit score' : null} onOpen={() => openScore(moderatorId, label, item)} /> })}{canScore && !selectedEntry.judgeScores.some(item => idOf(item.judgeId) === idOf(actorId)) && (!isAdmin || !selectedEntry.judgeScores.length) && <ScoreRow label="Your score" actionLabel="Add score" onOpen={() => openScore(idOf(actorId), 'Your score')} />}{!selectedEntry.judgeScores.length && !canScore && <p className="text-[12px] text-[var(--color-text-muted)]">No moderator scores were recorded.</p>}</div> : null}
      </section>}
    </div>}
    {activeScore && <ScoreModal title={`${activeScore.isEdit ? 'Edit' : 'Add'} score for ${activeScore.label}`} entryTitle={labelFor(selectedEntry)} form={form} setForm={setForm} onSubmit={submitScore} onDismiss={() => { if (!score.isPending) setActiveScore(null) }} pending={score.isPending} error={score.error} />}
  </div>
}

function Metric({ label, value }) { return <div className="rounded-[14px] border border-[var(--color-border)] p-4"><p className="text-[11px] text-[var(--color-text-muted)]">{label}</p><p className="mt-2 text-[22px] font-semibold text-[var(--color-text)]">{value}</p></div> }

function ScoreRow({ label, recorded, actionLabel, onOpen }) {
  return <div className="rounded-[12px] border border-[var(--color-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[13px] font-semibold text-[var(--color-text)]">{label}</p><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{recorded ? `Submitted by ${recorded.submittedByName || recorded.moderatorName || label}` : 'Awaiting score'}</p></div>{actionLabel && <Button variant="secondary" onClick={onOpen}>{actionLabel}</Button>}</div>{recorded && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--color-text-secondary)]"><span>Craft {recorded.craft}/10</span><span>Originality {recorded.originality}/10</span><span>Relevance {recorded.relevance}/10</span>{recorded.note && <p className="basis-full pt-1">{recorded.note}</p>}</div>}</div>
}

function ScoreModal({ title, entryTitle, form, setForm, onSubmit, onDismiss, pending, error }) {
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  return <ModalLayer aria-labelledby="competition-score-title" onDismiss={onDismiss} className="grid place-items-center p-4"><section className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-2xl"><ModalHeader title={title} titleId="competition-score-title" subtitle={entryTitle} onClose={onDismiss} closeLabel="Close score dialog" /><form className="overflow-y-auto p-4 sm:p-6" onSubmit={onSubmit}><div className="grid gap-3 sm:grid-cols-3">{[['craft', 'Craft'], ['originality', 'Originality'], ['relevance', 'Relevance']].map(([key, label]) => <label key={key} className="text-[11px] text-[var(--color-text-muted)]">{label}<input className={inputClass} type="number" min="1" max="10" step="1" required value={form[key]} onChange={event => update(key, event.target.value)} /></label>)}</div><label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">Note (optional)<textarea className={`${inputClass} min-h-20`} maxLength={1000} value={form.note} onChange={event => update('note', event.target.value)} /></label>{error && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{error.response?.data?.message || 'The score could not be saved.'}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={onDismiss}>Cancel</Button><Button type="submit" disabled={pending} aria-busy={pending}>Save score</Button></div></form></section></ModalLayer>
}
