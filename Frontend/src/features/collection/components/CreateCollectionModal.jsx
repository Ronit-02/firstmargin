import { useRef, useState } from 'react'
import Select from '@/shared/components/ui/Select'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import Button from '@/shared/components/ui/Button'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { useCreateCollection } from '../hooks/useCollections'

export default function CreateCollectionModal({ onClose }) {
  const closeButtonRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeButtonRef)
  const create = useCreateCollection()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const submit = event => {
    event.preventDefault()
    if (title.trim().length < 2 || create.isPending) return
    create.mutate({ title, description, visibility, postIds: [] }, { onSuccess: onClose })
  }
  return <ModalLayer onDismiss={onClose} aria-labelledby="create-collection-title" className="grid place-items-center p-4"><section ref={dialogRef} tabIndex={-1} className="w-full max-w-[560px] max-h-[calc(var(--overlay-height)-2rem)] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><ModalHeader title="Create a collection" titleId="create-collection-title" onClose={onClose} closeLabel="Close" closeRef={closeButtonRef} className="-mx-6 -mt-6" /><form className="mt-6" onSubmit={submit}><label htmlFor="collection-title" className="mb-2 block text-[12px] font-semibold text-[var(--color-text)]">Title <span aria-hidden="true">(required)</span></label><input id="collection-title" required minLength={2} value={title} maxLength={100} aria-describedby="collection-title-help" onChange={event => setTitle(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)]" /><p id="collection-title-help" className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">At least 2 characters · {title.length}/100</p><label htmlFor="collection-description" className="mt-4 mb-2 block text-[12px] font-semibold text-[var(--color-text)]">Description <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label><textarea id="collection-description" value={description} maxLength={500} aria-describedby="collection-description-help" onChange={event => setDescription(event.target.value)} className="w-full min-h-20 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)]" /><p id="collection-description-help" className="mt-1 text-right text-[11px] text-[var(--color-text-muted)]">{description.length}/500 characters</p><div className="mt-4"><Select id="collection-visibility" label="Visibility" value={visibility} options={[{ value: 'public', label: 'Public' }, { value: 'unlisted', label: 'Unlisted' }, { value: 'private', label: 'Private' }]} onChange={setVisibility} className="max-w-none" /></div>{create.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{create.error?.response?.data?.message || 'Collection could not be created.'}</p>}<div className="mt-5 flex justify-end gap-2"><span title={title.trim().length < 2 ? 'Title must be at least 2 characters.' : undefined} className={title.trim().length < 2 ? 'cursor-not-allowed [&>button]:pointer-events-none' : undefined}><Button type="submit" disabled={title.trim().length < 2 || create.isPending} aria-busy={create.isPending}>{'Create collection'}</Button></span></div></form></section></ModalLayer>
}

