import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import retainRetryView from '@/shared/utils/retainRetryView'
import ShortReadModal from '@/features/discovery/components/ShortReadModal'
import PostCardMenu from '@/features/discovery/components/PostCardMenu'
import ImageBox from '@/shared/components/ui/ImageBox'
import Button from '@/shared/components/ui/Button'
import Select from '@/shared/components/ui/Select'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import useFilePickerDismissGuard from '@/shared/hooks/useFilePickerDismissGuard'
import isValidImageUrl from '@/shared/utils/isValidImageUrl'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import { PenIcon, ShareIcon } from '@/shared/icons'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import MissingResourceState from '@/shared/components/ui/MissingResourceState'
import isMissingResourceError from '@/shared/errors/isMissingResourceError'
import PageFrame from '@/shared/components/layout/PageFrame'
import { useDeleteShortSeries, useEligibleSeriesPosts, useShortSeriesDetail, useUpdateShortSeries, useUploadSeriesCover } from '../hooks/useShortSeries'

function DeleteSeriesConfirmation({ series, deletion, triggerRef, onClose, onDeleted }) {
  const closeRef = useRef(null)
  const dismiss = () => { if (!deletion.isPending) onClose() }
  const dialogRef = useDialogFocus(dismiss, closeRef)
  return <ModalLayer onDismiss={dismiss} returnFocusRef={triggerRef} aria-labelledby="series-delete-title" className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-menu)]">
      <ModalHeader title="Delete series?" titleId="series-delete-title" onClose={dismiss} closeLabel="Close delete series" closeRef={closeRef} className="-mx-6 -mt-6" />
      <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">This permanently removes “{series.title}”. Stories in the series are not deleted.</p>
      {deletion.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">Could not delete series. Try again.</p>}
      <div className="mt-6 flex justify-end"><Button onClick={() => deletion.mutate(undefined, { onSuccess: onDeleted })} disabled={deletion.isPending} aria-busy={deletion.isPending} className="!bg-[var(--color-danger)] !border-[var(--color-danger)]">Delete series</Button></div>
    </section>
  </ModalLayer>
}

function SeriesContent({ series, id }) {
  const navigate = useNavigate()
  const location = useLocation()
  const update = useUpdateShortSeries(id)
  const uploadCover = useUploadSeriesCover(id)
  const deletion = useDeleteShortSeries(id)
  const type = series.type || 'short'
  const eligible = useEligibleSeriesPosts(type, id, series.isOwner)
  const [draftEntries, setDraftEntries] = useState(null)
  const [draftTitle, setDraftTitle] = useState(null)
  const [draftDescription, setDraftDescription] = useState(null)
  const [coverImage, setCoverImage] = useState(series.coverImage || '')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverSource, setCoverSource] = useState('upload')
  const [coverUrl, setCoverUrl] = useState('')
  const [removeCover, setRemoveCover] = useState(false)
  useEffect(() => {
    if (!coverPreview) return undefined
    return () => URL.revokeObjectURL(coverPreview)
  }, [coverPreview])
  const coverInputRef = useRef(null)
  const { pickerActiveRef, openPicker, releasePicker } = useFilePickerDismissGuard()
  const [editOpen, setEditOpen] = useState(() => Boolean(series.isOwner && location.state?.openEditSeries))
  useEffect(() => {
    if (location.state?.openEditSeries) navigate(location.pathname + location.search + location.hash, { replace: true, state: null })
  }, [location.hash, location.pathname, location.search, location.state, navigate])
  const [shareOpen, setShareOpen] = useState(false)
  const shareTriggerRef = useRef(null)
  const deleteTriggerRef = useRef(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shortReadId, setShortReadId] = useState(null)
  const entries = draftEntries || series.entries
  const title = draftTitle ?? series.title
  const description = draftDescription ?? series.description ?? ''
  const validTitle = title.trim().length >= 2 && title.trim().length <= 100
  const hasChanges = Boolean(coverFile || removeCover || (coverSource === 'url' && coverUrl.trim()) || draftEntries) || title.trim() !== series.title || description.trim() !== (series.description || '')
  const move = (index, direction) => setDraftEntries(current => {
    const next = [...(current || series.entries)]
    const target = index + direction
    if (target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const remove = postId => setDraftEntries(current => (current || series.entries).filter(entry => entry.id !== postId))
  const add = post => setDraftEntries(current => [...(current || series.entries), { ...post, format: type, author: series.author }])
  const save = async () => {
    if (!validTitle || description.trim().length > 500 || entries.length < 2 || !hasChanges || (coverUrl.trim() && !isValidImageUrl(coverUrl))) return
    try {
      await update.mutateAsync({ title: title.trim(), description: description.trim(), visibility: series.visibility, type, publicationIds: entries.map(entry => entry.id), ...(coverFile || removeCover ? { coverImage: '' } : coverSource === 'url' && coverUrl.trim() ? { coverImage: coverUrl.trim() } : {}) })
      if (coverFile) { try { const result = await uploadCover.mutateAsync(coverFile); setCoverImage(result.coverImage) } catch { setCoverImage('') } }
      else if (coverSource === 'url' && coverUrl.trim()) setCoverImage(coverUrl.trim())
      else if (removeCover) setCoverImage('')
      setDraftEntries(null); setDraftTitle(null); setDraftDescription(null); setCoverFile(null); setCoverPreview(null); setCoverUrl(''); setRemoveCover(false); setEditOpen(false)
    } catch { /* Keep the dialog open for a failed details save. */ }
  }
  const available = (eligible.data || []).filter(post => !entries.some(entry => entry.id === post.id))
  const editButton = className => <button type="button" onClick={() => setEditOpen(true)} aria-label="Edit series" title="Edit series" aria-haspopup="dialog" className={`${className} h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]`}><PenIcon /></button>
  const shareButton = className => <button type="button" onClick={event => { shareTriggerRef.current = event.currentTarget; setShareOpen(true) }} aria-label="Share this series" title="Share this series" aria-haspopup="dialog" className={`${className} h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]`}><ShareIcon /></button>
  const actions = className => <div className={`${className} items-center gap-2`}>{series.isOwner && editButton('flex')}{shareButton('flex')}</div>

  return <PageFrame>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">{type === 'short' ? 'Short series' : 'Story series'}</p>
    <div className="mt-3 flex items-center justify-between gap-6"><h1 className="min-w-0 text-[clamp(32px,5vw,52px)] leading-[1.03] tracking-[-0.05em] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{series.title}</h1>{actions('hidden sm:flex')}</div>
    <p className="mt-4 text-[14px] leading-7 text-[var(--color-text-secondary)]">{series.description}</p>
    <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">{entries.length} parts · by {series.author.username}</p>
    <div className="mt-4 flex justify-end sm:hidden">{actions('flex')}</div>
    {shareOpen && <ShareMenu anchorRef={shareTriggerRef} onClose={({ restoreFocus = false } = {}) => { setShareOpen(false); if (restoreFocus) requestAnimationFrame(() => shareTriggerRef.current?.focus()) }} id="series-share-menu" label="Share series" contentName="Series" url={`${window.location.origin}/series/${id}`} />}
    <ol className="mt-10 border-t border-[var(--color-border)]">{entries.map((entry, index) => <li key={entry.id} className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-start gap-x-3 border-b border-[var(--color-border)] py-5 sm:grid-cols-[3rem_minmax(0,1fr)_2.75rem] sm:gap-x-5 sm:py-6">
      <span className="pt-1 text-[12px] font-semibold text-[var(--color-text-muted)] sm:text-[13px]">{String(index + 1).padStart(2, '0')}</span>
      <div className={`min-w-0 ${type === 'article' && entry.image ? 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6' : ''}`}>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-[19px] font-bold leading-[1.25] tracking-[-0.035em] text-[var(--color-text)] sm:text-[22px]" style={{ fontFamily: 'var(--font-display)' }}><Link to={`/post/${entry.id}${type !== 'short' ? `?series=${encodeURIComponent(id)}` : ''}`} onClick={event => { if (type !== 'short' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); setShortReadId(entry.id) }} className="rounded-[4px] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">{entry.title}</Link></h2>
          {entry.excerpt && <p className="mt-2 line-clamp-2 break-words text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">{entry.excerpt}</p>}
          <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">{entry.readTime || (type === 'short' ? 'Short' : 'Story')}</p>
        </div>
        {type === 'article' && entry.image && <Link to={`/post/${entry.id}?series=${encodeURIComponent(id)}`} aria-label={`Read ${entry.title}`} className="order-first block w-full shrink-0 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] sm:order-last sm:w-40 lg:w-48"><ImageBox src={entry.image} alt="" height="auto" aspectRatio="16 / 9" radius="8px" /></Link>}
      </div>
      <PostCardMenu post={{ ...entry, format: type, author: entry.author || series.author }} variant={type} />
    </li>)}</ol>
    {type === 'short' && shortReadId && <ShortReadModal postId={shortReadId} onClose={() => setShortReadId(null)} listIds={series.entries.map(entry => entry.id)} inSeriesView />}
    {editOpen && <ModalLayer onDismiss={() => { if (!pickerActiveRef.current && !update.isPending && !uploadCover.isPending && !deletion.isPending && !deleteOpen) { setCoverFile(null); setCoverPreview(null); setCoverUrl(''); setEditOpen(false) } }} aria-labelledby="series-edit-title" className="grid place-items-center p-4">
      <section className="w-full max-w-[640px] max-h-[calc(var(--overlay-height)-2rem)] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <ModalHeader title="Edit series" titleId="series-edit-title" subtitle="Update the series details and reading order." onClose={() => { if (!pickerActiveRef.current && !update.isPending && !uploadCover.isPending && !deletion.isPending && !deleteOpen) { setCoverFile(null); setCoverPreview(null); setCoverUrl(''); setEditOpen(false) } }} closeLabel="Close edit series" className="-mx-6 -mt-6" />
        <div className="mt-6">
          <div className="mb-5">
            <p className="mb-3 text-[12px] font-semibold text-[var(--color-text)]">Series image <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span></p>
            <Select id="series-cover-source" label="Image source" value={coverSource} options={[{ value: 'upload', label: 'Upload file' }, { value: 'url', label: 'Paste URL' }]} onChange={value => { setCoverSource(value); setCoverFile(null); setCoverPreview(null); setCoverUrl('') }} className="mb-3 max-w-none" />
            {coverSource === 'url' && <label className="mb-3 block text-[12px]" htmlFor="series-cover-url">Image URL<input id="series-cover-url" type="url" value={coverUrl} onChange={event => { setCoverUrl(event.target.value); if (event.target.value) setRemoveCover(false) }} placeholder="https://..." className="mt-1 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]" /></label>}
            {(coverSource === 'url' ? coverUrl || (removeCover ? '' : coverImage) : coverPreview || (removeCover ? '' : coverImage)) ? <div className="relative"><img src={coverSource === 'url' ? coverUrl || (removeCover ? '' : coverImage) : coverPreview || (removeCover ? '' : coverImage)} alt="Series cover preview" className="block h-40 w-full rounded-[14px] object-cover" /><button type="button" aria-label="Remove series image" disabled={update.isPending || uploadCover.isPending} onClick={() => { setCoverFile(null); setCoverPreview(null); setCoverUrl(''); setRemoveCover(true) }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border-none bg-black/60 text-[18px] text-white disabled:opacity-60">×</button></div> : coverSource === 'upload' ? <button type="button" onClick={() => openPicker(coverInputRef.current)} disabled={update.isPending || uploadCover.isPending} className="flex min-h-40 w-full items-center justify-center rounded-[14px] border-2 border-dashed border-[var(--color-border)] bg-transparent px-3 py-3 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] disabled:opacity-60">+ Add image</button> : null}
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onCancel={releasePicker} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; releasePicker(); if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); setRemoveCover(false) } }} />
          </div>
          <label htmlFor="edit-series-title" className="mb-2 block text-[12px] font-semibold text-[var(--color-text)]">Title <span aria-hidden="true">(required)</span></label>
          <input id="edit-series-title" required minLength={2} maxLength={100} value={title} onChange={event => setDraftTitle(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)]" />
          <p className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">At least 2 characters · {title.length}/100</p>
          <label htmlFor="edit-series-description" className="mt-4 mb-2 block text-[12px] font-semibold text-[var(--color-text)]">Description <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label>
          <textarea id="edit-series-description" maxLength={500} value={description} onChange={event => setDraftDescription(event.target.value)} className="w-full min-h-20 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)]" />
          <h2 className="mt-6 text-[13px] font-semibold text-[var(--color-text)]">Series order</h2>
          <ol className="mt-3 border-t border-[var(--color-border)]">{entries.map((entry, index) => <li key={entry.id} className="flex items-center gap-3 border-b border-[var(--color-border)] py-3"><span className="w-6 shrink-0 text-[11px] text-[var(--color-text-muted)]">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 text-[13px] text-[var(--color-text)]">{entry.title}</span><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${entry.title} earlier`} className="button-target h-11 min-h-11 w-11 min-w-11 rounded-full border border-[var(--color-border)] disabled:opacity-30">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === entries.length - 1} aria-label={`Move ${entry.title} later`} className="button-target h-11 min-h-11 w-11 min-w-11 rounded-full border border-[var(--color-border)] disabled:opacity-30">↓</button><button type="button" onClick={() => remove(entry.id)} aria-label={`Remove ${entry.title} from series`} className="button-target h-11 min-h-11 w-11 min-w-11 rounded-full border border-[var(--color-border)]">×</button></li>)}</ol>
          <h2 className="mt-6 text-[13px] font-semibold text-[var(--color-text)]">Add {type === 'short' ? 'shorts' : 'stories'}</h2>
          {eligible.isPending && <p role="status" className="mt-3 text-[12px] text-[var(--color-text-muted)]">Loading your writing…</p>}
          {eligible.isError && <div className="mt-3"><p role="alert" className="text-[12px] text-[var(--color-danger)]">Your writing could not be loaded.</p><Button variant="secondary" className="mt-2" onClick={() => eligible.refetch()}>Try again</Button></div>}
          {!eligible.isPending && !eligible.isError && (available.length > 0 ? <div className="mt-3"><Select id="series-add-writing" label={`Choose a ${type === 'short' ? 'short' : 'story'} to add`} value="" options={available.map(post => ({ value: post.id, label: post.title }))} onChange={postId => { const post = available.find(item => item.id === postId); if (post && entries.length < 50) add(post) }} disabled={entries.length >= 50 || update.isPending || deletion.isPending} className="max-w-none" /></div> : <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">No other published {type === 'short' ? 'shorts' : 'stories'} are available to add.</p>)}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3"><Button ref={deleteTriggerRef} variant="secondary" onClick={() => setDeleteOpen(true)} disabled={update.isPending || uploadCover.isPending || deletion.isPending} className="!text-[var(--color-danger)]">Delete series</Button><Button onClick={save} disabled={!hasChanges || !validTitle || description.trim().length > 500 || entries.length < 2 || update.isPending || uploadCover.isPending || deletion.isPending || Boolean(coverUrl.trim() && !isValidImageUrl(coverUrl))} aria-busy={update.isPending || uploadCover.isPending}>Save series</Button></div>
          {draftEntries && entries.length < 2 && <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">A series needs at least two parts.</p>}{update.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">Could not save series</p>}
        </div>
      </section>
    </ModalLayer>}
    {deleteOpen && <DeleteSeriesConfirmation series={series} deletion={deletion} triggerRef={deleteTriggerRef} onClose={() => setDeleteOpen(false)} onDeleted={() => navigate('/series', { replace: true })} />}
  </PageFrame>
}

export default function ShortSeriesDetail() {
  const { id } = useParams()
  const legacyPath = useLocation().pathname.startsWith('/shorts/series/')
  const query = retainRetryView(useShortSeriesDetail(id))
  if (query.isPending) return <PageFrame><ListSkeleton count={4} label="Loading series" /></PageFrame>
  if (query.isError && isMissingResourceError(query.error)) return legacyPath
    ? <MissingResourceState eyebrow="Short series unavailable" title="This short series is no longer available" detail="It may have been removed, made private, or the link may be incorrect. Explore other shorts instead." recoveryTo="/shorts" recoveryLabel="Explore shorts" />
    : <MissingResourceState eyebrow="Series unavailable" title="This series is no longer available" detail="It may have been removed, made private, or the link may be incorrect. Explore other series instead." recoveryTo="/series" recoveryLabel="Explore series" />
  if (query.isError) return <PageFrame><div><p role="alert" className="text-[13px] text-[var(--color-danger)]">This series could not be loaded.</p><Button variant="secondary" className="mt-4" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div></PageFrame>
  return <SeriesContent key={id} id={id} series={query.data} />
}
