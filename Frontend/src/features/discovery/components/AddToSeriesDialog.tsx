import { useId, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import Select from '@/shared/components/ui/Select'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import SeriesIcon from '@/shared/icons/SeriesIcon'
import CreateSeriesModal from './CreateSeriesModal'
import { useAddPostToSeries, useOwnedSeries } from '../hooks/useShortSeries'

type Props = {
  postId: string
  title: string
  format?: 'article' | 'short'
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement>
}

const errorMessage = (error: unknown) => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return 'The story could not be added. Try again.'
  const response = error.response
  if (typeof response !== 'object' || response === null || !('data' in response)) return 'The story could not be added. Try again.'
  const data = response.data
  return typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
    ? data.message
    : 'The story could not be added. Try again.'
}

export function SeriesActionIcon() {
  return <SeriesIcon />
}

export default function AddToSeriesDialog({ postId, title, format = 'article', onClose, returnFocusRef }: Props) {
  const navigate = useNavigate()
  const id = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const [selectedSeriesId, setSelectedSeriesId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const seriesQuery = useOwnedSeries(format, postId)
  const add = useAddPostToSeries()
  const series = seriesQuery.data?.pages.flatMap(page => page.data) || []
  const selectedSeries = series.find(item => item.id === selectedSeriesId)
  const selectedSeriesContainsPost = Boolean(selectedSeries?.containsPost)
  const selectedSeriesIsFull = Number(selectedSeries?.entriesCount || 0) >= 50
  const pending = add.isPending
  const close = () => { if (!pending && !submitting.current) onClose() }
  const dialogRef = useDialogFocus(close, closeRef)
  const submit = async () => {
    if (!selectedSeriesId || selectedSeriesContainsPost || selectedSeriesIsFull || submitting.current) return
    submitting.current = true
    try {
      await add.mutateAsync({ seriesId: selectedSeriesId, postId })
      onClose()
    } catch { /* Keep the selected series available for retry. */ }
    finally { submitting.current = false }
  }
  const formatLabel = format === 'short' ? 'short' : 'story'

  if (showCreate) return <CreateSeriesModal onClose={onClose} onCreated={(seriesId: string) => navigate(`/series/${seriesId}`)} />

  return <ModalLayer onDismiss={close} returnFocusRef={returnFocusRef} aria-labelledby={`${id}-heading`} className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[520px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModalHeader title="Add to series" titleId={`${id}-heading`} subtitle={title} onClose={close} closeRef={closeRef} closeLabel="Close add to series" className="-mx-6 -mt-6" />
      <div className="mt-6">
        {seriesQuery.isPending && <p role="status" className="text-[13px] text-[var(--color-text-secondary)]">Loading your {formatLabel} series…</p>}
        {seriesQuery.isError && <div><p role="alert" className="text-[13px] text-[var(--color-danger)]">Your series could not be loaded.</p><Button variant="secondary" className="mt-3" disabled={seriesQuery.isFetching} aria-busy={seriesQuery.isFetching} onClick={() => seriesQuery.refetch()}>Try again</Button></div>}
        {!seriesQuery.isPending && !seriesQuery.isError && <>
          {series.length === 0 && !seriesQuery.hasNextPage
            ? <div><p className="text-[13px] text-[var(--color-text-secondary)]">You do not have an existing {formatLabel} series yet.</p><div className="mt-4 flex flex-wrap gap-2"><Link to={`/series?type=${format}`} onClick={onClose} className="button-target inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] px-[18px] py-2 text-[13px] font-medium text-[var(--color-text)]">Browse series</Link><Button onClick={() => setShowCreate(true)}>Create series</Button></div></div>
            : <Select id={`${id}-series`} label={`Choose one of your ${formatLabel} series`} value={selectedSeriesId} onChange={value => { setSelectedSeriesId(value); add.reset() }} disabled={pending} pagination={seriesQuery} paginationDisabled={pending} options={series.map(item => ({ value: item.id, label: item.title, badge: item.containsPost ? 'Already added' : Number(item.entriesCount) >= 50 ? '50 parts · Full' : `${item.entriesCount} parts` }))} className="max-w-none" />}
          {selectedSeriesContainsPost && <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">This {formatLabel} is already in the selected series.</p>}
          {add.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">{errorMessage(add.error)}</p>}
          {series.length > 0 && <div className="mt-5 flex justify-end"><Button disabled={!selectedSeriesId || selectedSeriesContainsPost || selectedSeriesIsFull || pending} aria-busy={pending} onClick={submit}>{selectedSeriesContainsPost ? 'Already in series' : selectedSeriesIsFull ? 'Series is full' : 'Add to series'}</Button></div>}
        </>}
      </div>
    </section>
  </ModalLayer>
}
