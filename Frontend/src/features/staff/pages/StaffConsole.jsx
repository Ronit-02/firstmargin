import Select from '@/shared/components/ui/Select'
import PageFrame from '@/shared/components/layout/PageFrame'
import retainRetryView from '@/shared/utils/retainRetryView'
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- The navigation container correctly owns tab semantics. */
import { useEffect, useRef, useState } from 'react'
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
import useFilePickerDismissGuard from '@/shared/hooks/useFilePickerDismissGuard'
import { createCompetition, updateCompetition, fetchReports, reviewReport } from '../api/staff'
import UserDirectory from '../components/UserDirectory'

const fieldClass = 'rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px]'
const emptyCompetition = { title: '', description: '', coverImage: '', coverImageFile: null, openDate: '', closeDate: '', competitionType: 'reader_choice', rules: '' }
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
  const { pickerActiveRef, openPicker, releasePicker } = useFilePickerDismissGuard()
  const requestedTab = params.get('staffTab')
  const tab = staffTabs.some(item => item.id === requestedTab) ? requestedTab : 'moderation'
  const setTab = nextTab => setParams(current => {
    const next = new URLSearchParams(current)
    if (nextTab === 'moderation') next.delete('staffTab')
    else next.set('staffTab', nextTab)
    return next
  })
  const [reportStatus, setReportStatus] = useState('all')
  const [notes, setNotes] = useState({})
  const [form, setForm] = useState(emptyCompetition)
  const [competitionFilter, setCompetitionFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile })
  const isStaff = ['moderator', 'admin'].includes(me.data?.role)
  const reports = retainRetryView(useQuery({ queryKey: ['staff', 'reports', reportStatus], queryFn: () => fetchReports(reportStatus), enabled: isStaff && tab === 'moderation' }))
  const competitions = useQuery({ queryKey: ['competitions', 'staff', competitionFilter], queryFn: () => fetchCompetitions(competitionFilter === 'past' ? 'closed' : undefined), enabled: isStaff && tab === 'competitions' })
  const review = useMutation({ mutationFn: reviewReport, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff', 'reports'] }); notify('Moderation decision recorded.') }, onError: () => notify('The moderation decision could not be saved.', { tone: 'error' }) })
  const competition = useMutation({ mutationFn: createCompetition, onSuccess: data => { setForm(emptyCompetition); setModal(null); queryClient.invalidateQueries({ queryKey: ['competitions'] }); notify('Competition created.'); if (data.coverUploadFailed) notify('Cover image can’t be uploaded right now. The default cover is being used.', { tone: 'error' }) }, onError: () => notify('The competition could not be created.', { tone: 'error' }) })
  const competitionEdit = useMutation({ mutationFn: updateCompetition, onSuccess: data => { setModal(null); queryClient.invalidateQueries({ queryKey: ['competitions'] }); queryClient.invalidateQueries({ queryKey: ['competition', String(data.id)] }); notify('Competition updated.'); if (data.coverUploadFailed) notify('Cover image can’t be uploaded right now. The default cover is being used.', { tone: 'error' }) }, onError: () => notify('The competition could not be updated.', { tone: 'error' }) })
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
    {tab === 'competitions' && <div id="staff-competitions-panel" role="tabpanel" aria-label="Competitions content"><CompetitionHub competitions={competitions} filter={competitionFilter} setFilter={setCompetitionFilter} isAdmin={me.data.role === 'admin'} onCreate={() => { setForm(emptyCompetition); setModal({ type: 'create-competition' }) }} onEdit={item => { setForm({ ...emptyCompetition, title: item.title, description: item.description || '', coverImage: item.coverImage || '', rules: (item.rules || []).join('\n') }); setModal({ type: 'edit-competition', item }) }} onJudge={competitionItem => navigate(`/staff/competitions/${competitionItem.id}/judging`)} /></div>}
    {tab === 'users' && <div id="staff-users-panel" role="tabpanel" aria-label="Users content"><UserDirectory currentUserId={me.data.id} /></div>}
    {modal?.type === 'report-review' && <StaffModal title="Review report" onDismiss={() => !review.isPending && setModal(null)}><ReportReviewForm report={modal.report} notes={notes} setNotes={setNotes} review={review} onDone={() => setModal(null)} /></StaffModal>}
    {modal?.type === 'create-competition' && <StaffModal title="Create competition" onDismiss={() => !pickerActiveRef.current && !competition.isPending && setModal(null)}><CompetitionCreation form={form} setForm={setForm} mutation={competition} isAdmin={me.data.role === 'admin'} openPicker={openPicker} releasePicker={releasePicker} /></StaffModal>}
    {modal?.type === 'edit-competition' && <StaffModal title="Edit competition" onDismiss={() => !pickerActiveRef.current && !competitionEdit.isPending && setModal(null)}><CompetitionCreation form={form} setForm={setForm} mutation={competitionEdit} item={modal.item} isAdmin openPicker={openPicker} releasePicker={releasePicker} /></StaffModal>}
  </PageFrame>
}

function ModerationQueue({ reports, status, setStatus, onReview }) {
  return <section><div className="mb-5 flex items-center gap-3"><SectionHeading className="min-w-0">Reports</SectionHeading><FilterBar label="Status" options={[{ id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'reviewing', label: 'Reviewing' }, { id: 'dismissed', label: 'Dismissed' }]} value={status} onChange={setStatus} /></div>{reports.isLoading && <p role="status" aria-label="Loading moderation reports" className="py-8 text-[13px] text-[var(--color-text-muted)]">Loading reports…</p>}{reports.isError && <div role="alert" className="py-8"><p className="text-[13px] text-[var(--color-danger)]">Moderation reports could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => reports.refetch()} aria-busy={reports.isFetching} disabled={reports.isFetching}>Try again</Button></div>}{!reports.isLoading && !reports.isError && reports.data?.length === 0 && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">{status === 'all' ? 'No reports.' : 'No ' + status + ' reports.'}</p>}{!reports.isLoading && !reports.isError && reports.data?.map(report => <article key={report._id} className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--color-border)] p-5"><div className="min-w-0"><div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"><span>{report.subjectType}</span><span>{report.reason}</span><span>{new Date(report.createdAt).toLocaleString()}</span></div><p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{report.details || 'No additional details provided.'}</p></div><Button variant="secondary" onClick={() => onReview(report)}>{['dismissed', 'actioned'].includes(report.status) ? 'View report' : 'Review report'}</Button></article>)}</section>
}

function ReportReviewForm({ report, notes, setNotes, review, onDone }) {
  const note = notes[report._id] || ''
  const updateNote = value => setNotes(current => ({ ...current, [report._id]: value }))
  const submit = action => review.mutate({ reportId: report._id, action, note }, { onSuccess: onDone })
  const isReadOnly = ['dismissed', 'actioned'].includes(report.status)
  return <div className="space-y-4 p-4 sm:p-6"><div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{report.subjectType} · {report.reason}</div><p className="text-[13px] text-[var(--color-text-secondary)]">{report.details || 'No additional details provided.'}</p>{!isReadOnly && <><label htmlFor={`review-note-${report._id}`} className="block text-[11px] font-semibold text-[var(--color-text-muted)]">Review note <span aria-hidden="true">(required)</span><textarea id={`review-note-${report._id}`} required maxLength={2000} value={note} aria-describedby={`review-note-help-${report._id}`} onChange={event => updateNote(event.target.value)} className="mt-1 min-h-28 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[12px]" /></label><p id={`review-note-help-${report._id}`} className="text-right text-[11px] text-[var(--color-text-muted)]">{note.length}/2,000 characters</p><div className="flex flex-wrap gap-2">{[['begin_review', 'Begin review'], ['recommend_remove', 'Recommend removal'], ['recommend_suspend', 'Recommend suspension'], ['dismiss', 'Dismiss']].map(([action, label]) => <Button key={action} variant={action === 'dismiss' ? undefined : 'secondary'} disabled={!note.trim() || review.isPending} onClick={() => submit(action)} aria-busy={review.isPending}>{label}</Button>)}</div></>}</div>
}

function CompetitionHub({ competitions, filter, setFilter, isAdmin, onCreate, onEdit, onJudge }) {
  const items = (competitions.data || []).filter(item => filter === 'all' || (filter === 'past' ? item.status === 'closed' : item.status !== 'closed'))
  return <section><div className="flex flex-wrap items-center gap-3"><SectionHeading className="mr-auto min-w-0 max-sm:basis-full">Competitions</SectionHeading><Button onClick={onCreate} disabled={!isAdmin} leadingIcon={isAdmin ? <span className="text-[17px] leading-none">+</span> : undefined}>{isAdmin ? 'Add competition' : 'Admin required'}</Button><div className="max-sm:ml-auto"><FilterBar label="Status" options={[{ id: 'all', label: 'All' }, { id: 'ongoing', label: 'Ongoing' }, { id: 'past', label: 'Past' }]} value={filter} onChange={setFilter} /></div></div>{competitions.isLoading && <p role="status" className="py-8 text-[13px] text-[var(--color-text-muted)]">Loading competitions…</p>}{competitions.isError && <div role="alert" className="py-8"><p className="text-[13px] text-[var(--color-danger)]">Competitions could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => competitions.refetch()}>Try again</Button></div>}{!competitions.isLoading && !competitions.isError && !items.length && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">{filter === 'all' ? 'No competitions.' : 'No ' + filter + ' competitions.'}</p>}{!competitions.isLoading && !competitions.isError && <div className="mt-5 space-y-3">{items.map(item => <article key={item.id} className="relative flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--color-border)] p-5"><Link to={`/explore/competitions/${item.id}`} aria-label={`View ${item.title} competition`} className="absolute inset-0 rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">{item.status} · {competitionTypeLabel(item)}</p><h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">{item.title}</h2><p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Voting closes {new Date(item.closeDate).toLocaleString()}</p></div><div className="relative z-10 flex flex-wrap gap-2">{item.status === 'open' && <Button variant="secondary" onClick={() => onEdit(item)}>Edit</Button>}<Button variant="secondary" onClick={() => onJudge(item)}>{item.status === 'closed' ? 'Review results' : item.status !== 'judging' ? 'View entries' : ['collective_choice', 'hybrid', 'judges'].includes(item.competitionType) || ['hybrid', 'judges'].includes(item.votingMode) ? 'Add and review scores' : 'View results'}</Button></div></article>)}</div>}</section>
}

function StaffModal({ title, onDismiss, children }) {
  const titleId = `staff-modal-${title.toLowerCase().replaceAll(' ', '-')}`
  return <ModalLayer aria-labelledby={titleId} onDismiss={onDismiss} className="grid place-items-center p-4"><section className="flex w-[min(680px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-2xl"><ModalHeader title={title} titleId={titleId} onClose={onDismiss} closeLabel={`Close ${title.toLowerCase()}`} /><div className="max-h-[calc(var(--overlay-height)-7rem)] overflow-y-auto">{children}</div></section></ModalLayer>
}

function CompetitionCreation({ form, setForm, mutation, isAdmin, item, openPicker, releasePicker }) {
  const coverInputRef = useRef(null)
  const [coverSource, setCoverSource] = useState('upload')
  const [coverPreview, setCoverPreview] = useState('')
  useEffect(() => {
    if (!coverPreview) return undefined
    return () => URL.revokeObjectURL(coverPreview)
  }, [coverPreview])
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const chooseCover = event => { const file = event.target.files?.[0]; if (file) { setForm(current => ({ ...current, coverImageFile: file, coverImage: '' })); setCoverPreview(URL.createObjectURL(file)) } releasePicker() }
  const submit = event => {
    event.preventDefault()
    if (!form.title.trim() || (!item && (!form.openDate || !form.closeDate)) || mutation.isPending || !isAdmin) return
    const input = { title: form.title, description: form.description, coverImage: form.coverImage, coverImageFile: form.coverImageFile, rules: form.rules.split('\n').filter(Boolean) }
    mutation.mutate(item ? { ...input, id: item.id } : { ...input, openDate: new Date(form.openDate).toISOString(), closeDate: new Date(form.closeDate).toISOString(), competitionType: form.competitionType })
  }
  const coverSection = <div className="text-[11px] text-[var(--color-text-muted)] md:col-span-2"><p className="mb-3">Cover image <span className="font-normal">(optional)</span></p><Select id="competition-cover-source" label="Image source" value={coverSource} options={[{ value: 'upload', label: 'Upload file' }, { value: 'url', label: 'Paste URL' }]} onChange={setCoverSource} className="mb-3 max-w-none" />{coverSource === 'url' && <label htmlFor="competition-cover-image" className="mb-3 block">Image URL<input id="competition-cover-image" type="url" value={form.coverImage} onChange={event => { setForm(current => ({ ...current, coverImage: event.target.value, coverImageFile: null })); setCoverPreview('') }} placeholder="https://..." className={`${fieldClass} mt-1 w-full`} /></label>}{(coverPreview || form.coverImage) ? <div className="relative"><img src={coverPreview || form.coverImage} alt="Competition cover preview" className="block h-40 w-full rounded-[14px] object-cover" /><button type="button" aria-label="Remove competition cover image" disabled={mutation.isPending} onClick={() => { setForm(current => ({ ...current, coverImage: '', coverImageFile: null })); setCoverPreview(''); if (coverInputRef.current) coverInputRef.current.value = '' }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border-none bg-black/60 text-[18px] text-white disabled:opacity-60">×</button></div> : coverSource === 'upload' ? <button type="button" onClick={() => openPicker(coverInputRef.current)} disabled={mutation.isPending} className="flex min-h-40 w-full items-center justify-center rounded-[14px] border-2 border-dashed border-[var(--color-border)] bg-transparent px-3 py-3 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] disabled:opacity-60">+ Add image</button> : null}<input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Upload cover image" onCancel={releasePicker} onChange={chooseCover} /><span className="mt-2 block text-[10px] text-[var(--color-text-muted)]">JPG, PNG, WebP, or GIF; up to 8 MB.</span></div>
  return <section className="rounded-[18px] border border-[var(--color-border)] p-6"><h2 className="text-[18px] font-bold text-[var(--color-text)]">{item ? 'Edit competition' : 'Create competition'}</h2><form className="mt-5" onSubmit={submit}><div className="grid gap-3 md:grid-cols-2">{!item && coverSection}<label htmlFor="competition-title" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Title <span aria-hidden="true">(required)</span><input id="competition-title" required minLength={2} maxLength={140} value={form.title} onChange={event => update('title', event.target.value)} className={`${fieldClass} mt-1 w-full`} /></label><label htmlFor="competition-description" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Description <span className="font-normal">(optional)</span><textarea id="competition-description" maxLength={3000} value={form.description} onChange={event => update('description', event.target.value)} className={`${fieldClass} mt-1 w-full min-h-28`} /></label>{item && coverSection}{!item && <><DateField id="competition-open" label="Opens" value={form.openDate} required onChange={value => update('openDate', value)} /><DateField id="competition-close" label="Voting closes" value={form.closeDate} required onChange={value => update('closeDate', value)} /><Select id="competition-type" label="Competition type" value={form.competitionType} options={[{ value: 'reader_choice', label: 'Readers’ Choice' }, { value: 'collective_choice', label: 'Collective Choice' }]} onChange={value => update('competitionType', value)} className="max-w-none" /></>}<label htmlFor="competition-rules" className="text-[11px] text-[var(--color-text-muted)] md:col-span-2">Rules <span className="font-normal">(one per line)</span><textarea id="competition-rules" value={form.rules} onChange={event => update('rules', event.target.value)} className={`${fieldClass} mt-1 w-full min-h-24`} /></label></div><div className={item ? 'mt-4 flex justify-end' : 'mt-4'}><Button type="submit" disabled={!form.title.trim() || (!item && (!form.openDate || !form.closeDate)) || mutation.isPending || !isAdmin} aria-busy={mutation.isPending}>{isAdmin ? (item ? 'Save changes' : 'Create competition') : 'Admin required'}</Button></div>{mutation.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">{mutation.error?.response?.data?.message || (item ? 'Could not update competition.' : 'Could not create competition.')}</p>}</form></section>
}

function DateField({ id, label, value, required = false, onChange }) { return <label htmlFor={id} className="text-[11px] text-[var(--color-text-muted)]">{label}{required && <span aria-hidden="true"> (required)</span>}<input id={id} required={required} type="datetime-local" value={value} onChange={event => onChange(event.target.value)} className={`${fieldClass} mt-1 w-full`} /></label> }
