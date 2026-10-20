import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import retainRetryView from '@/shared/utils/retainRetryView'
import Button from '@/shared/components/ui/Button'
import { PostCardSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import PageHeader from '@/shared/components/ui/PageHeader'
import PageFrame from '@/shared/components/layout/PageFrame'
import Avatar from '@/shared/components/ui/Avatar'
import useToast from '@/shared/hooks/useToast'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useEntitlements from '../hooks/useEntitlements'
import { startMembershipCheckout } from '../api/membership'
import { fetchCreatorUpdates, fetchEarlyAccess, fetchWorkshops, registerWorkshop } from '../api/memberExperience'

const sections = [{ id: 'early', label: 'Early access' }, { id: 'updates', label: 'Creator extras' }, { id: 'workshops', label: 'Workshops' }]
const memberCardGrid = 'grid grid-cols-1 gap-4 min-[540px]:grid-cols-2 lg:grid-cols-3'
const memberExperienceGrid = `${memberCardGrid} auto-rows-fr`

export default function MemberHub() {
  const user = useSelector(state => state.auth.user)
  const isReady = useSelector(state => state.auth.isReady)
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requestedSection = params.get('memberTab')
  const section = sections.some(item => item.id === requestedSection) ? requestedSection : 'early'
  const setSection = nextSection => setParams(current => {
    const next = new URLSearchParams(current)
    if (nextSection === 'early') next.delete('memberTab')
    else next.set('memberTab', nextSection)
    return next
  })
  const [selectedExtra, setSelectedExtra] = useState(null)
  const extraTriggerRef = useRef(null)
  const entitlements = useEntitlements(true)
  const capabilities = new Set(entitlements.data?.capabilities || [])
  const updates = retainRetryView(useQuery({ queryKey: ['creator-updates'], queryFn: fetchCreatorUpdates, enabled: capabilities.has('behind_scenes') }))
  const earlyAccess = retainRetryView(useQuery({ queryKey: ['early-access', user], queryFn: fetchEarlyAccess, enabled: capabilities.has('early_access') }))
  const earlyPosts = (earlyAccess.data || []).filter(post => post.format !== 'short')
  const workshops = retainRetryView(useQuery({ queryKey: ['workshops', user || 'anonymous'], queryFn: fetchWorkshops, enabled: isReady }))
  const register = useMutation({ mutationFn: registerWorkshop, onSuccess: (_data, workshopId) => {
    queryClient.setQueryData(['workshops', user || 'anonymous'], current => current?.map(workshop => workshop._id === workshopId ? { ...workshop, isRegistered: true } : workshop))
    queryClient.invalidateQueries({ queryKey: ['workshops', user || 'anonymous'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    notify('Place reserved. The workshop link will be sent to your notifications.')
  }, onError: error => notify(error?.response?.data?.message || 'The workshop reservation could not be completed.', { tone: 'error' }) })
  const checkout = useMutation({ mutationFn: startMembershipCheckout, onSuccess: data => window.location.assign(data.checkoutUrl), onError: () => notify('Billing is temporarily unavailable.', { tone: 'error' }) })

  const handleSectionKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = sections.findIndex(item => item.id === section)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length
    setSection(sections[nextIndex].id)
    requestAnimationFrame(() => document.getElementById(`member-tab-${sections[nextIndex].id}`)?.focus())
  }

  if (entitlements.isLoading) return <PageFrame><div role="status" aria-label="Loading member hub"><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-10 w-3/5" /><Skeleton className="mt-4 h-4 w-full max-w-2xl" /><div className="mt-8 flex gap-2"><Skeleton className="h-9 w-24 rounded-full" /><Skeleton className="h-9 w-24 rounded-full" /><Skeleton className="h-9 w-24 rounded-full" /></div><div className="card-grid card-grid--post mt-8 gap-4"><PostCardSkeleton compact /><PostCardSkeleton compact /></div></div></PageFrame>
  return (
    <PageFrame>
      <PageHeader eyebrow="Membership" title="Closer to the creative process" description="Join workshops and see creator notes from writers." />
      <div aria-label="Member hub sections" role="tablist" className="mb-8 flex max-w-full gap-2 overflow-x-auto border-b border-[var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sections.map(item => <button key={item.id} id={`member-tab-${item.id}`} type="button" role="tab" aria-controls="member-tabpanel" aria-selected={section === item.id} tabIndex={section === item.id ? 0 : -1} onKeyDown={handleSectionKeyDown} onClick={() => setSection(item.id)} className={`button-target inline-flex min-h-11 shrink-0 items-center rounded-t-[10px] border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 sm:min-h-0 ${section === item.id ? 'border-[var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{item.label}</button>)}</div>
      <div id="member-tabpanel" role="tabpanel" aria-labelledby={`member-tab-${section}`}>
        {section === 'early' && !capabilities.has('early_access') && <Locked title="Early releases are a member benefit" checkout={checkout} />}
        {section === 'early' && capabilities.has('early_access') && (earlyAccess.isLoading ? <div role="status" aria-label="Loading early access" className={memberCardGrid}><PostCardSkeleton compact /><PostCardSkeleton compact /></div> : earlyAccess.isError ? <QueryError label="Early-release stories" onRetry={() => earlyAccess.refetch()} /> : earlyPosts.length ? <div className={memberCardGrid}>{earlyPosts.map(post => <DiscoveryPostCard key={post.id} post={post} variant="grid" />)}</div> : <Empty text="No early-release stories are available right now." />)}
        {section === 'updates' && !capabilities.has('behind_scenes') && <Locked title="Creator extras are a member benefit" checkout={checkout} />}
        {section === 'updates' && capabilities.has('behind_scenes') && (updates.isLoading ? <div role="status" aria-label="Loading creator extras" className={memberExperienceGrid}><PostCardSkeleton compact /><PostCardSkeleton compact /></div> : updates.isError ? <QueryError label="Creator extras" onRetry={() => updates.refetch()} /> : <div className={memberExperienceGrid}>{updates.data?.length ? updates.data.map(item => <article key={item._id} className="group relative min-w-0 min-h-60 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:bg-[var(--color-bg-alt)] focus-within:bg-[var(--color-bg-alt)]"><div className="relative z-10 mb-4 flex w-fit items-center gap-2">{item.creatorId?.username ? <Link to={`/author/${encodeURIComponent(item.creatorId.username)}`} aria-label={`View ${item.creatorId.username}'s profile`} className="flex items-center gap-2 rounded-[4px] text-[12px] font-semibold !text-[var(--color-text-muted)] transition-colors hover:!text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><Avatar src={item.creatorId.picture} name={item.creatorId.username} size={28} /><span>{item.creatorId.username}</span></Link> : <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text-secondary)]"><Avatar size={28} /><span>firstmargin writer</span></span>}</div><h2 className="text-[18px] font-bold text-[var(--color-text)]">{item.title}</h2><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-[13px] leading-[1.7] text-[var(--color-text-secondary)]">{item.body}</p><button type="button" aria-label={`Read ${item.title}`} onClick={event => { extraTriggerRef.current = event.currentTarget; setSelectedExtra(item) }} className="absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]" /></article>) : <Empty text="Creator extras will appear here when writers publish them." />}</div>)}
        {section === 'workshops' && (workshops.isLoading ? <div role="status" aria-label="Loading workshops" className={memberExperienceGrid}><PostCardSkeleton compact /><PostCardSkeleton compact /></div> : workshops.isError ? <QueryError label="Workshops" onRetry={() => workshops.refetch()} /> : <div className={memberExperienceGrid}>{workshops.data?.length ? workshops.data.map(workshop => <WorkshopCard key={workshop._id} workshop={workshop} capabilities={capabilities} register={register} />) : <Empty text="No upcoming workshops are published yet." />}</div>)}
      </div>
      {selectedExtra && <ModalLayer onDismiss={() => setSelectedExtra(null)} returnFocusRef={extraTriggerRef} aria-labelledby="creator-extra-title" className="grid place-items-center p-4"><section className="w-full max-w-[640px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)]"><ModalHeader title="Creator extras" titleId="creator-extra-title" onClose={() => setSelectedExtra(null)} closeLabel="Close creator extra" /><div className="p-6"><h3 className="break-words text-[18px] font-bold text-[var(--color-text)]">{selectedExtra.title}</h3><div className="mt-4 mb-5 flex items-center gap-2"><Avatar src={selectedExtra.creatorId?.picture} name={selectedExtra.creatorId?.username} size={28} /><span className="text-[12px] font-semibold text-[var(--color-text-secondary)]">{selectedExtra.creatorId?.username}</span></div><p className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-[var(--color-text-secondary)]">{selectedExtra.body}</p></div></section></ModalLayer>}
    </PageFrame>
  )
}

function WorkshopCard({ workshop, capabilities, register }) {
  const spaceRef = useRef(null)
  const descriptionRef = useRef(null)
  const [lines, setLines] = useState(1)

  useEffect(() => {
    const space = spaceRef.current
    const description = descriptionRef.current
    if (!space || !description) return undefined
    let active = true
    const update = () => {
      const lineHeight = parseFloat(getComputedStyle(description).lineHeight)
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return
      const next = Math.max(1, Math.floor((space.clientHeight + 0.5) / lineHeight))
      if (active) setLines(current => current === next ? current : next)
    }
    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(() => requestAnimationFrame(update))
    observer.observe(space)
    document.fonts?.ready.then(() => { if (active) requestAnimationFrame(update) })
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect() }
  }, [workshop.description])

  return <article className="flex h-[320px] min-w-0 flex-col rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
    <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">{new Date(workshop.startsAt).toLocaleString()}</p>
    <h2 className="mt-2 line-clamp-3 shrink-0 text-[18px] font-bold text-[var(--color-text)]">{workshop.title}</h2>
    <div ref={spaceRef} className="mt-2 min-h-0 flex-1 overflow-hidden">
      <p ref={descriptionRef} className="overflow-hidden whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-[var(--color-text-secondary)] [display:-webkit-box] [-webkit-box-orient:vertical]" style={{ WebkitLineClamp: lines }}>{workshop.description}</p>
    </div>
    <Button className="mt-5 shrink-0 self-start" disabled={workshop.isRegistered || !capabilities.has('workshops') || register.isPending} onClick={() => register.mutate(workshop._id)} aria-busy={register.isPending}>{workshop.isRegistered ? 'Place reserved' : capabilities.has('workshops') ? 'Reserve a place' : 'Members only'}</Button>
  </article>
}

function Locked({ title, checkout }) { return <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 text-center"><h2 className="font-bold text-[18px] text-[var(--color-text)]">{title}</h2><p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Join firstmargin to unlock this experience while keeping primary stories open to everyone.</p><Button className="mt-5" disabled={checkout.isPending} onClick={() => checkout.mutate()} aria-busy={checkout.isPending}>{'Become a member'}</Button>{checkout.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">{checkout.error?.response?.data?.message || 'Billing is temporarily unavailable.'}</p>}</section> }
function QueryError({ label, onRetry }) { return <div role="alert" className="py-10"><p className="text-[13px] text-[var(--color-danger)]">{label} could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={onRetry}>Try again</Button></div> }
function Empty({ text }) { return <p className="col-span-full py-10 text-center text-[13px] text-[var(--color-text-muted)]">{text}</p> }
