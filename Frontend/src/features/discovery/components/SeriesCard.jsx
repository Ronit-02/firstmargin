import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ImageBox from '@/shared/components/ui/ImageBox'
import ActionMenu, { ActionMenuTrigger, ActionMenuItem, HideActionIcon } from '@/shared/components/ui/ActionMenu'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import Button from '@/shared/components/ui/Button'
import LinkIcon from '@/shared/icons/LinkIcon'
import { PenIcon } from '@/shared/icons'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import useToast from '@/shared/hooks/useToast'
import { useDeleteShortSeries, useSeriesSave } from '../hooks/useShortSeries'

export default function SeriesCard({ series }) {
  const navigate = useNavigate()
  const { notify } = useToast()
  const deletion = useDeleteShortSeries(series.id)
  const save = useSeriesSave(series.id)
  const triggerRef = useRef(null)
  const deleteCloseRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const chapterSpaceRef = useRef(null)
  const chapterListRef = useRef(null)
  const moreRef = useRef(null)
  const [visibleChapters, setVisibleChapters] = useState(0)
  const menuId = `series-menu-${series.id}`
  const deleteDialogId = `delete-series-dialog-${series.id}`
  const closeDelete = () => { if (!deletion.isPending) setDeleteOpen(false) }
  const deleteDialogRef = useDialogFocus(closeDelete, deleteCloseRef, deleteOpen)
  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const isShortSeries = series.type === 'short'
  const formatLabel = isShortSeries ? 'Short series' : 'Story series'
  const writerName = series.author?.username || 'firstmargin writer'
  const preview = series.entriesPreview || series.entries?.map((entry, index) => ({ id: entry.id, title: entry.title, position: index + 1 })) || []
  const previewKey = JSON.stringify(preview)
  const hasMore = series.entriesCount > visibleChapters && preview.length > 0

  useEffect(() => {
    const space = chapterSpaceRef.current
    const list = chapterListRef.current
    const more = moreRef.current
    if (!space || !list || !more || hidden) return undefined
    let active = true
    const measure = () => {
      if (!active) return
      const top = list.getBoundingClientRect().top
      const bottoms = Array.from(list.children, row => row.getBoundingClientRect().bottom - top)
      const available = space.clientHeight
      let count = bottoms.filter(bottom => bottom <= available + 0.5).length
      if (count < series.entriesCount) {
        const remaining = available - more.getBoundingClientRect().height
        count = bottoms.filter(bottom => bottom <= remaining + 0.5).length
      }
      setVisibleChapters(current => current === count ? current : count)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(space)
    for (const row of list.children) observer.observe(row)
    observer.observe(more)
    document.fonts?.ready.then(measure)
    measure()
    return () => { active = false; observer.disconnect() }
  }, [previewKey, series.entriesCount, hidden])

  if (hidden) return null

  return (
    <article className="series-card group relative min-w-0 overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-hover)]">
      <div className="absolute right-3 top-3 z-10">
        <ActionMenuTrigger ref={triggerRef} type="button" aria-label={`More options for ${series.title}`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setMenuOpen(value => !value)} />
        {menuOpen && <ActionMenu anchorRef={triggerRef} onClose={closeMenu} id={menuId} label={`Options for ${series.title}`}>
          {series.isOwner && <ActionMenuItem icon={<PenIcon />} onClick={() => navigate(`/series/${series.id}`, { state: { openEditSeries: true } })}>Edit series</ActionMenuItem>}
          <ActionMenuItem icon={<LinkIcon />} onClick={() => { closeMenu(); setShareOpen(true) }}>Share link</ActionMenuItem>
          {!series.isOwner && <ActionMenuItem onClick={() => save.mutate(!series.isSaved)}>{series.isSaved ? 'Remove from saved' : 'Save series'}</ActionMenuItem>}
          {series.isOwner && <ActionMenuItem tone="danger" icon={<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>} onClick={() => { closeMenu(); setDeleteOpen(true) }}>Delete series</ActionMenuItem>}
          <ActionMenuItem icon={<HideActionIcon />} onClick={() => { setHidden(true); setMenuOpen(false); notify('Series hidden from this list.', { tone: 'info' }) }}>Not interested</ActionMenuItem>
        </ActionMenu>}
      </div>
      <div className="series-card__layout">
        <div className="series-card__identity min-w-0">
          <div className="series-card__cover overflow-hidden rounded-[8px] [&>div]:h-full"><ImageBox src={series.coverImage} alt="" height="100%" radius="8px" placeholderLabel={formatLabel} fallbackVariant="series" /></div>
          <div className="series-card__copy min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{formatLabel} <span aria-hidden="true" className="mx-1">·</span> {series.entriesCount} parts</p>
            <h2 className="mt-2 line-clamp-2 text-[20px] font-bold leading-[1.25] tracking-[-0.025em] text-[var(--color-text)] group-hover:text-[var(--color-accent)]" style={{ fontFamily: 'var(--font-display)' }}><Link to={`/series/${series.id}`} aria-label={`View series ${series.title}`} className="rounded-[4px] after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">{series.title}</Link></h2>
            <p className="relative z-[2] mt-2 truncate text-[12px] font-medium text-[var(--color-text-secondary)]"><Link to={series.author?.handle ? `/author/${encodeURIComponent(series.author.handle)}` : '/author'} className="rounded-[4px] transition-colors hover:!text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">by {writerName}</Link></p>
            {series.description && <p className="mt-3 line-clamp-2 border-t border-[var(--color-border)] pt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">{series.description}</p>}
          </div>
        </div>
        <div className="series-card__chapters min-w-0 border-t border-[var(--color-border)] pt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">Chapters</p>
          {preview.length ? <div ref={chapterSpaceRef} className="series-card__preview">
            <ol ref={chapterListRef} className="absolute inset-0 min-w-0">{preview.map((entry, index) => <li key={entry.id || index} aria-hidden={index >= visibleChapters} style={{ visibility: index < visibleChapters ? 'visible' : 'hidden' }} className="flex min-w-0 items-center gap-3 border-t border-[var(--color-border)] py-2.5 first:border-t-0"><span className="shrink-0 text-[17px] text-[var(--color-text-secondary)]" style={{ fontFamily: 'var(--font-display)' }}>{String(entry.position || index + 1).padStart(2, '0')}</span><span className="min-w-0 truncate text-[12px] font-medium text-[var(--color-text)]">{entry.title}</span></li>)}</ol>
            <p ref={moreRef} aria-hidden={!hasMore} style={{ visibility: hasMore ? 'visible' : 'hidden' }} className="absolute inset-x-0 bottom-0 pt-1 text-[11px] text-[var(--color-text-muted)]">+ {Math.max(0, series.entriesCount - visibleChapters)} more</p>
          </div> : <p className="py-3 text-[12px] text-[var(--color-text-muted)]">{series.entriesCount} parts in reading order</p>}
        </div>
      </div>
      {shareOpen && <ShareMenu anchorRef={triggerRef} id={`series-share-${series.id}`} label="Share series" contentName="Series" url={`${window.location.origin}/series/${series.id}`} onClose={({ restoreFocus = false } = {}) => { setShareOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()) }} />}
      {deleteOpen && <ModalLayer onDismiss={closeDelete} returnFocusRef={triggerRef} aria-labelledby={`${deleteDialogId}-title`} className="flex items-center justify-center p-4 backdrop:bg-black/40">
        <section ref={deleteDialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-menu)]">
          <ModalHeader title="Delete series?" titleId={`${deleteDialogId}-title`} onClose={closeDelete} closeLabel="Cancel delete" closeRef={deleteCloseRef} className="-mx-6 -mt-6" />
          <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">This permanently removes “{series.title}”. Stories in the series are not deleted.</p>
          {deletion.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">Could not delete series. Try again.</p>}
          <div className="mt-6 flex justify-end"><Button onClick={() => deletion.mutate(undefined, { onSuccess: () => { setDeleteOpen(false); setHidden(true) } })} disabled={deletion.isPending} aria-busy={deletion.isPending} className="!bg-[var(--color-danger)] !border-[var(--color-danger)]">Delete series</Button></div>
        </section>
      </ModalLayer>}
    </article>
  )
}
