import Select from '@/shared/components/ui/Select'
import PageFrame from '@/shared/components/layout/PageFrame'
import retainRetryView from '@/shared/utils/retainRetryView'
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- The navigation container correctly owns tab semantics. */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '@/shared/components/ui/Button'
import FilterBar from '@/shared/components/ui/FilterBar'
import SectionHeading from '@/shared/components/ui/SectionHeading'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import { fetchMyProfile } from '@/features/user/api/profile'
import { fetchCompetitions } from '@/features/competition/api/competitions'
import competitionTypeLabel from '@/features/competition/utils/competitionTypeLabel'
import useToast from '@/shared/hooks/useToast'
import { createCompetition, fetchReports, reviewReport } from '../api/staff'
import UserDirectory from '../components/UserDirectory'

const fieldClass = 'rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px]'
const emptyCompetition = { title: '', description: '', coverImage: '', openDate: '', closeDate: '', competitionType: 'reader_choice', rules: '' }
const staffTabs = [
  { id: 'moderation', label: 'Moderation' },
  { id: 'competitions', label: 'Competitions' },
  { id: 'users', label: 'Users' },
]

export default function StaffConsole() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { notify } = useToast()
  const requestedTab = params.get('staffTab')
  const tab = staffTabs.some(item => item.id === requestedTab) ? requestedTab : 'moderation'
  const setTab = nextTab => setParams(current => {
    const next = new URLSearchParams(current)
    if (nextTab === 'moderation') next.delete('staffTab')
    else next.set('staffTab', nextTab)
    return next
  })
  const [reportStatus, setReportStatus] = useState('pending')
  const [notes, setNotes] = useState({})
  const [form, setForm] = useState(emptyCompetition)
  const [competitionFilter, setCompetitionFilter] = useState('ongoing')
  const [modal, setModal] = useState(null)
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile })
  const isStaff = ['moderator', 'admin'].includes(me.data?.role)
  const reports = retainRetryView(useQuery({ queryKey: ['staff', 'reports', reportStatus], queryFn: () => fetchReports(reportStatus), enabled: isStaff && tab === 'moderation' }))
  const competitions = useQuery({ queryKey: ['competitions', 'staff', competitionFilter], queryFn: () => fetchCompetitions(competitionFilter === 'past' ? 'closed' : undefined), enabled: isStaff && tab === 'competitions' })
  const review = useMutation({ mutationFn: reviewReport, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff', 'reports'] }); notify('Moderation decision recorded.') }, onError: () => notify('The moderation decision could not be saved.', { tone: 'error' }) })
  const competition = useMutation({ mutationFn: createCompetition, onSuccess: () => { setForm(emptyCompetition); setModal(null); queryClient.invalidateQueries({ queryKey: ['competitions'] }); notify('Competition created.') }, onError: () => notify('The competition could not be created.', { tone: 'error' }) })
  const handleTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = staffTabs.findIndex(item => item.id === tab)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? staffTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + staffTabs.length) % staffTabs.length
    const nextTab = staffTabs[nextIndex].id
    setTab(nextTab)
    requestAnimationFrame(() => document.querySelector(`[role="tab"][aria-controls="staff-${nextTab}-panel"]`)?.focus())
  }

  if (me.isLoading) return <PageFrame><p role="status" className="text-[13px] text-[var(--color-text-muted)]">Verifying staff access…</p></PageFrame>
  if (!isStaff) return <PageFrame className="text-center"><h1 className="text-[28px] font-bold text-[var(--color-text)]">Staff access required</h1><p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">This workspace is available only to authorized moderators and administrators.</p></PageFrame>

  return <PageFrame className="!pt-10 !pb-20">
    <header><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent)]">Operations</p><h1 className="mt-2 text-[30px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Staff console</h1><p className="mt-3 max-w-[640px] text-[13px] leading-6 text-[var(--color-text-secondary)]">Review reports, manage competitions, and oversee user accounts.</p></header>
    <nav className="my-8 flex max-w-full gap-2 overflow-x-auto border-b border-[var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Staff console sections" role="tablist">
      {staffTabs.map(item => <button key={item.id} type="button" role="tab" aria-controls={`staff-${item.id}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={handleTabKeyDown} className={`button-target inline-flex min-h-11 shrink-0 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0 ${tab === item.id ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{item.label}</button>)}
    </nav>
    {tab === 'moderation' && <div id="staff-moderation-panel" role="tabpanel" aria-label="Moderation content"><ModerationQueue reports={reports} status={reportStatus} setStatus={setReportStatus} notes={notes} setNotes={setNotes} review={review} onReview={report => setModal({ type: 'report-review', report })} /></div>}
    {tab === 'competitions' && <div id="staff-competitions-panel" role="tabpanel" aria-label="Competitions content"><CompetitionHub competitions={competitions} filter={competitionFilter} setFilter={setCompetitionFilter} isAdmin={me.data.role === 'admin'} onCreate={() => setModal({ type: 'create-competition' })} onJudge={competitionItem => navigate(`/staff/competitions/${competitionItem.id}/judging`)} /></div>}
    {tab === 'users' && <div id="staff-users-panel" role="tabpanel" aria-label="Users content"><UserDirectory currentUserId={me.data.id} /></div>}
    {modal?.type === 'report-review' && <StaffModal title="Review report" onDismiss={() => !review.isPending && setModal(null)}><ReportReviewForm report={modal.report} notes={notes} setNotes={setNotes} review={review} onDone={() => setModal(null)} /></StaffModal>}
    {modal?.type === 'create-competition' && <StaffModal title="Create competition" onDismiss={() => !competition.isPending && setModal(null)}><CompetitionCreation form={form} setForm={setForm} mutation={competition} isAdmin={me.data.role === 'admin'} /></StaffModal>}
  </PageFrame>
}

function ModerationQueue({ reports, status, setStatus, onReview }) {
  return <section><div className="mb-5 flex items-center gap-3"><SectionHeading className="min-w-0">Reports</SectionHeading><FilterBar label="Status" options={[{ id: 'pending', label: 'Pending' }, { id: 'reviewing', label: 'Reviewing' }, { id: 'dismissed', label: 'Dismissed' }]} value={status} onChange={setStatus} /></div>{reports.isLoading && <p role="status" aria-label="Loading moderation reports" className="py-8 text-[13px] text-[var(--color-text-muted)]">Loading reports…</p>}{reports.isError && <div role="alert" className="py-8"><p className="text-[13px] text-[var(--color-danger)]">Moderation reports could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => reports.refetch()} aria-busy={reports.isFetching} disabled={reports.isFetching}>Try again</Button></div>}{!reports.isLoading && !reports.isError && reports.data?.length === 0 && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">No {status} reports.</p>}{!reports.isLoading && !reports.isError && reports.data?.map(report => <article key={report._id} className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--color-border)] p-5"><div className="min-w-0"><div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"><span>{report.subjectType}</span><span>{report.reason}</span><span>{new Date(report.createdAt).toLocaleString()}</span></div><p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{report.details || 'No additional details provided.'}</p></div><Button variant="secondary" onClick={() => onReview(report)}>{['dismissed', 'actioned'].includes(report.status) ? 'View report' : 'Review report'}</Button></article>)}</section>
}

function ReportReviewForm({ report, notes, setNotes, review, onDone }) {
  const note = notes[report._id] || ''
  const updateNote = value => setNotes(current => ({ ...current, [report._id]: value }))
  const submit = action => review.mutate({ reportId: report._id, action, note }, { onSuccess: onDone })
  const isReadOnly = ['dismissed', 'actioned'].includes(report.status)
  return <div className="space-y-4 p-4 sm:p-6"><div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{report.subjectType} · {report.reason}</div><p className="text-[13px] text-[var(--color-text-secondary)]">{report.details || 'No additional details provided.'}</p>{!isReadOnly && <><label htmlFor={`review-note-${report._id}`} className="block text-[11px] font-semibold text-[var(--color-text-muted)]">Review note <span aria-hidden="true">(required)</span><textarea id={`review-note-${report._id}`} required maxLength={2000} value={note} aria-describedby={`review-note-help-${report._id}`} onChange={event => updateNote(event.target.value)} className="mt-1 min-h-28 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[12px]" /></label><p id={`review-note-help-${report._id}`} className="text-right text-[11px] text-[var(--color-text-muted)]">{note.length}/2,000 characters</p><div className="flex flex-wrap gap-2">{[['begin_review', 'Begin review'], ['recommend_remove', 'Recommend removal'], ['recommend_suspend', 'Recommend suspension'], ['dismiss', 'Dismiss']].map(([action, label]) => <Button key={action} variant={action === 'dismiss' ? undefined : 'secondary'} disabled={!note.trim() || review.isPending} onClick={() => submit(action)} aria-busy={review.isPending}>{label}</Button>)}</div></>}</div>
}

function CompetitionHub({ competitions, filter, setFilter, isAdmin, onCreate, onJudge }) {
  const items = (competitions.data || []).filter(item => filter === 'past' ? item.status === 'closed' : item.status !== 'closed')
  return <section><div className="flex flex-wrap items-center gap-3"><SectionHeading className="mr-auto min-w-0 max-sm:basis-full">Competitions</SectionHeading><Button onClick={onCreate} disabled={!isAdmin} leadingIcon={isAdmin ? <span className="text-[17px] leading-none">+</span> : undefined}>{isAdmin ? 'Add competition' : 'Admin required'}</Button><div className="max-sm:ml-auto"><FilterBar label="Status" options={[{ id: 'ongoing', label: 'Ongoing' }, { id: 'past', label: 'Past' }]} value={filter} onChange={setFilter} /></div></div>{competitions.isLoading && <p role="status" className="py-8 text-[13px] text-[var(--color-text-muted)]">Loading competitions…</p>}{competitions.isError && <div role="alert" className="py-8"><p className="text-[13px] text-[var(--color-danger)]">Competitions could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => competitions.refetch()}>Try again</Button></div>}{!competitions.isLoading && !competitions.isError && !items.length && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">No {filter} competitions.</p>}{!competitions.isLoading && !competitions.isError && <div className="mt-5 space-y-3">{items.map(item => <article key={item.id} className="relative flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--color-border)] p-5"><Link to={`/explore/competitions/${item.id}`} aria-label={`View ${item.title} competition`} className="absolute inset-0 rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">{item.status} · {competitionTypeLabel(item)}</p><h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">{item.title}</h2><p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Voting closes {new Date(item.closeDate).toLocaleString()}</p></div><Button variant="secondary" className="relative z-10" onClick={() => onJudge(item)}>{item.status === 'closed' ? 'Review results' : ['collective_choice', 'hybrid', 'judges'].includes(item.competitionType) || ['hybrid', 'judges'].includes(item.votingMode) ? 'Add and review scores' : 'View results'}</Button></article>)}</div>}</section>
}

function StaffModal({ title, onDismiss, children }) {
  const titleId = `staff-modal-${title.toLowerCase().replaceAll(' ', '-')}`
  return <ModalLayer aria-labelledby={titleId} onDismiss={onDismiss} className="grid place-items-center p-4"><section className="flex w-[min(680px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-2xl"><ModalHeader title={title} titleId={titleId} onClose={onDismiss} closeLabel={`Close ${title.toLowerCase()}`} /><div className="max-h-[calc(var(--overlay-height)-7rem)] overflow-y-auto">{children}</div></section></ModalLayer>
}

function CompetitionCreation({ form, setForm, mutation, isAdmin }) {
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = event => {
    event.preventDefault()
    if (!form.title.trim() || !form.openDate || !form.closeDate || mutation.isPending || !isAdmin) return
    mutation.mutate({ ...form, openDate: new Date(form.openDate).toISOString(), closeDate: new Date(form.closeDate).toISOString(), rules: form.rules.split('\n').filter(Boolean) })
  }
  return <section className="rounded-[18px] border border-[var(--color-border)] p-6"><h2 className="text-[18px] font-bold text-[var(--color-text)]">Create competition</h2><form className="mt-5" onSubmit={submit}><div className="grid gap-3 md:grid-cols-2"><label htmlFor="competition-title" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Title <span aria-hidden="true">(required)</span><input id="competition-title" required minLength={2} maxLength={140} value={form.title} onChange={event => update('title', event.target.value)} className={`${fieldClass} mt-1 w-full`} /></label><label htmlFor="competition-description" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Description <span className="font-normal">(optional)</span><textarea id="competition-description" maxLength={3000} value={form.description} onChange={event => update('description', event.target.value)} className={`${fieldClass} mt-1 w-full min-h-28`} /></label><label htmlFor="competition-cover-image" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Cover image URL <span className="font-normal">(optional)</span><input id="competition-cover-image" type="url" value={form.coverImage} onChange={event => update('coverImage', event.target.value)} placeholder="https://..." className={`${fieldClass} mt-1 w-full`} /><span className="mt-1 block text-[10px] text-[var(--color-text-muted)]">Leave empty to use the standard competition placeholder.</span></label><DateField id="competition-open" label="Opens" value={form.openDate} required onChange={value => update('openDate', value)} /><DateField id="competition-close" label="Voting closes" value={form.closeDate} required onChange={value => update('closeDate', value)} /><Select id="competition-type" label="Competition type" value={form.competitionType} options={[{ value: 'reader_choice', label: 'Readers’ Choice' }, { value: 'collective_choice', label: 'Collective Choice' }]} onChange={value => update('competitionType', value)} className="max-w-none" /><label htmlFor="competition-rules" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Rules <span className="font-normal">(one per line)</span><textarea id="competition-rules" value={form.rules} onChange={event => update('rules', event.target.value)} className={`${fieldClass} mt-1 w-full min-h-24`} /></label></div><Button type="submit" className="mt-4" disabled={!form.title.trim() || !form.openDate || !form.closeDate || mutation.isPending || !isAdmin} aria-busy={mutation.isPending}>{isAdmin ? 'Create competition' : 'Admin required'}</Button>{mutation.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">{mutation.error?.response?.data?.message || 'Could not create competition.'}</p>}</form></section>
}

function DateField({ id, label, value, required = false, onChange }) { return <label htmlFor={id} className="text-[11px] text-[var(--color-text-muted)]">{label}{required && <span aria-hidden="true"> (required)</span>}<input id={id} required={required} type="datetime-local" value={value} onChange={event => onChange(event.target.value)} className={`${fieldClass} mt-1 w-full`} /></label> }
