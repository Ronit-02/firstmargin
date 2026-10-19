import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import retainRetryView from '@/shared/utils/retainRetryView'
import Button from '@/shared/components/ui/Button'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useToast from '@/shared/hooks/useToast'
import { createWorkshop, fetchMyCreatorUpdates, fetchMyWorkshops, fetchReceivedRequests, publishCreatorUpdate, updateReceivedRequest } from '../api/memberExperience'

const fieldClass = 'w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-[13px]'
const emptyWorkshop = { title: '', description: '', startsAt: '', endsAt: '', capacity: '100', meetingUrl: '' }
const dateLabel = value => value ? new Date(value).toLocaleString() : ''
const isActive = workshop => workshop.status === 'published' && new Date(workshop.endsAt).getTime() > Date.now()

export default function CreatorTools({ tab }) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [modal, setModal] = useState(null)
  const [workshopFilter, setWorkshopFilter] = useState('active')
  const [update, setUpdate] = useState({ title: '', body: '' })
  const [workshopForm, setWorkshopForm] = useState(emptyWorkshop)
  const openerRef = useRef(null)
  const updates = retainRetryView(useQuery({ queryKey: ['creator-updates', 'mine'], queryFn: fetchMyCreatorUpdates, enabled: tab === 'updates' }))
  const workshops = retainRetryView(useQuery({ queryKey: ['workshops', 'mine'], queryFn: fetchMyWorkshops, enabled: tab === 'workshops' }))
  const requests = retainRetryView(useQuery({ queryKey: ['creator-requests', 'received'], queryFn: fetchReceivedRequests, enabled: tab === 'requests' }))
  const publish = useMutation({ mutationFn: publishCreatorUpdate, onSuccess: () => { setUpdate({ title: '', body: '' }); setModal(null); queryClient.invalidateQueries({ queryKey: ['creator-updates'] }); notify('Creator update published.') }, onError: () => notify('The creator update could not be published.', { tone: 'error' }) })
  const hostWorkshop = useMutation({ mutationFn: createWorkshop, onSuccess: () => { setWorkshopForm(emptyWorkshop); setModal(null); queryClient.invalidateQueries({ queryKey: ['workshops'] }); notify('Workshop published.') }, onError: () => notify('The workshop could not be published.', { tone: 'error' }) })
  const respond = useMutation({ mutationFn: updateReceivedRequest, onSuccess: (_, input) => { queryClient.invalidateQueries({ queryKey: ['creator-requests', 'received'] }); notify(`Request ${input.status}.`) }, onError: () => notify('The request response could not be saved.', { tone: 'error' }) })
  const setWorkshop = (key, value) => setWorkshopForm(current => ({ ...current, [key]: value }))
  const openModal = (event, type) => { openerRef.current = event.currentTarget; setModal(type) }
  const submitWorkshop = event => {
    event.preventDefault()
    if (!workshopForm.title.trim() || !workshopForm.description.trim() || !workshopForm.startsAt || !workshopForm.endsAt || !workshopForm.meetingUrl || hostWorkshop.isPending) return
    hostWorkshop.mutate({ ...workshopForm, startsAt: new Date(workshopForm.startsAt).toISOString(), endsAt: new Date(workshopForm.endsAt).toISOString(), capacity: Number(workshopForm.capacity) })
  }
  const submitUpdate = event => {
    event.preventDefault()
    if (!update.title.trim() || !update.body.trim() || publish.isPending) return
    publish.mutate(update)
  }
  const visibleWorkshops = (workshops.data || []).filter(item => isActive(item) === (workshopFilter === 'active'))

  return <>
    {tab === 'updates' && <section aria-label="Your creator updates">
      <div className="mb-5 flex items-center justify-end"><Button onClick={event => openModal(event, 'update')}>Add update</Button></div>
      {updates.isLoading ? <div role="status" aria-label="Loading your updates"><ListSkeleton count={3} role={undefined} /></div> : updates.isError ? <LoadError label="Your updates" onRetry={() => updates.refetch()} /> : updates.data?.length ? <div className="space-y-3">{updates.data.map(item => <article key={item._id} className="rounded-[14px] border border-[var(--color-border)] p-5"><p className="text-[11px] text-[var(--color-text-muted)]">{item.status} · {dateLabel(item.publishedAt || item.createdAt)}</p><h2 className="mt-2 text-[16px] font-semibold text-[var(--color-text)]">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.65] text-[var(--color-text-secondary)]">{item.body}</p></article>)}</div> : <Empty text="You haven't published any creator updates yet." />}
    </section>}
    {tab === 'workshops' && <section aria-label="Your workshops">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2" role="group" aria-label="Workshop status">{['active', 'inactive'].map(status => <Button key={status} variant={workshopFilter === status ? 'primary' : 'secondary'} aria-pressed={workshopFilter === status} onClick={() => setWorkshopFilter(status)}>{status === 'active' ? 'Active' : 'Inactive'}</Button>)}</div><Button onClick={event => openModal(event, 'workshop')}>Create workshop</Button></div>
      {workshops.isLoading ? <div role="status" aria-label="Loading your workshops"><ListSkeleton count={3} role={undefined} /></div> : workshops.isError ? <LoadError label="Your workshops" onRetry={() => workshops.refetch()} /> : visibleWorkshops.length ? <div className="space-y-3">{visibleWorkshops.map(item => <article key={item._id} className="rounded-[14px] border border-[var(--color-border)] p-5"><p className="text-[11px] text-[var(--color-text-muted)]">{dateLabel(item.startsAt)} · {item.status}</p><h2 className="mt-2 text-[16px] font-semibold text-[var(--color-text)]">{item.title}</h2><p className="mt-2 text-[13px] leading-[1.65] text-[var(--color-text-secondary)]">{item.description}</p><p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Capacity: {item.capacity}</p></article>)}</div> : <Empty text={workshopFilter === 'active' ? 'No active workshops.' : 'No inactive workshops.'} />}
    </section>}
    {tab === 'requests' && <section aria-label="Direct requests">
      {requests.isLoading ? <div role="status" aria-label="Loading direct requests"><ListSkeleton count={3} role={undefined} /></div> : requests.isError ? <LoadError label="Direct requests" onRetry={() => requests.refetch()} /> : requests.data?.length ? requests.data.map(request => <article key={request._id} className="mb-3 rounded-[14px] border border-[var(--color-border)] p-4"><p className="text-[11px] text-[var(--color-text-muted)]">From {request.requesterId?.username} · {request.status}</p><h2 className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">{request.subject}</h2><p className="mt-2 text-[12px] leading-[1.6] text-[var(--color-text-secondary)]">{request.details}</p>{request.status === 'pending' && <div className="mt-3 flex gap-2"><Button disabled={respond.isPending} aria-busy={respond.isPending} onClick={() => respond.mutate({ requestId: request._id, status: 'accepted' })}>Accept</Button><Button variant="secondary" disabled={respond.isPending} aria-busy={respond.isPending} onClick={() => respond.mutate({ requestId: request._id, status: 'declined' })}>Decline</Button></div>}</article>) : <Empty text="No direct requests yet." />}
    </section>}
    {modal && <ModalLayer onDismiss={() => setModal(null)} returnFocusRef={openerRef} aria-labelledby="creator-form-title" className="grid place-items-center p-4"><section className="w-full max-w-[640px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)]"><ModalHeader title={modal === 'update' ? 'Add update' : 'Create workshop'} titleId="creator-form-title" closeLabel="Close form" onClose={() => setModal(null)} /><div className="p-6">{modal === 'update' ? <form onSubmit={submitUpdate}>
      <label htmlFor="creator-update-title" className="block text-[11px] text-[var(--color-text-muted)]">Title <span aria-hidden="true">(required)</span><input id="creator-update-title" required minLength={2} maxLength={140} value={update.title} aria-describedby="creator-update-title-help" onChange={event => setUpdate({ ...update, title: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <p id="creator-update-title-help" className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">{update.title.length}/140 characters</p>
      <label htmlFor="creator-update-body" className="mt-3 block text-[11px] text-[var(--color-text-muted)]">Update <span aria-hidden="true">(required)</span><textarea id="creator-update-body" required maxLength={10000} value={update.body} aria-describedby="creator-update-body-help" onChange={event => setUpdate({ ...update, body: event.target.value })} className={`${fieldClass} mt-1 min-h-36 resize-y`} /></label>
      <p id="creator-update-body-help" className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">{update.body.length}/10,000 characters</p>
      <Button type="submit" className="mt-4" disabled={!update.title.trim() || !update.body.trim() || publish.isPending} aria-busy={publish.isPending}>Publish update</Button>
      {publish.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">Could not publish this update.</p>}
    </form> : <form onSubmit={submitWorkshop}><div className="grid grid-cols-2 gap-3">
      <label htmlFor="workshop-title" className="col-span-2 text-[11px] text-[var(--color-text-muted)]">Title <span aria-hidden="true">(required)</span><input id="workshop-title" required minLength={2} maxLength={140} value={workshopForm.title} onChange={event => setWorkshop('title', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label htmlFor="workshop-description" className="col-span-2 text-[11px] text-[var(--color-text-muted)]">Description <span aria-hidden="true">(required)</span><textarea id="workshop-description" required maxLength={3000} value={workshopForm.description} onChange={event => setWorkshop('description', event.target.value)} className={`${fieldClass} mt-1 min-h-24 resize-y`} /></label>
      <label htmlFor="workshop-starts" className="text-[11px] text-[var(--color-text-muted)]">Starts <span aria-hidden="true">(required)</span><input id="workshop-starts" required type="datetime-local" value={workshopForm.startsAt} onChange={event => setWorkshop('startsAt', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label htmlFor="workshop-ends" className="text-[11px] text-[var(--color-text-muted)]">Ends <span aria-hidden="true">(required)</span><input id="workshop-ends" required type="datetime-local" value={workshopForm.endsAt} onChange={event => setWorkshop('endsAt', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label htmlFor="workshop-capacity" className="text-[11px] text-[var(--color-text-muted)]">Capacity <input id="workshop-capacity" type="number" min="1" max="10000" value={workshopForm.capacity} onChange={event => setWorkshop('capacity', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label htmlFor="workshop-url" className="text-[11px] text-[var(--color-text-muted)]">Private meeting URL <span aria-hidden="true">(required)</span><input id="workshop-url" required type="url" value={workshopForm.meetingUrl} onChange={event => setWorkshop('meetingUrl', event.target.value)} className={`${fieldClass} mt-1`} /></label>
    </div><Button type="submit" className="mt-4" disabled={!workshopForm.title.trim() || !workshopForm.description.trim() || !workshopForm.startsAt || !workshopForm.endsAt || !workshopForm.meetingUrl || hostWorkshop.isPending} aria-busy={hostWorkshop.isPending}>Publish workshop</Button>
      {hostWorkshop.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">{hostWorkshop.error?.response?.data?.message || 'Could not publish this workshop.'}</p>}
    </form>}</div></section></ModalLayer>}
  </>
}

function LoadError({ label, onRetry }) { return <div role="alert" className="py-10"><p className="text-[13px] text-[var(--color-danger)]">{label} could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={onRetry}>Try again</Button></div> }
function Empty({ text }) { return <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">{text}</p> }
