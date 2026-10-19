import { useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import Button from '@/shared/components/ui/Button'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import Select from '@/shared/components/ui/Select'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { useAddCollectionPost, useCollectionChoices, useCreateCollection } from '../hooks/useCollections'
import useBookmarkPost from '@/features/post/hooks/useBookmarkPost'

type Props = { postId: string; title: string; onClose: () => void; returnFocusRef?: RefObject<HTMLElement>; saveMode?: boolean; isBookmarked?: boolean }
const fieldClass = 'w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)]'
const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback
  const response = error.response
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback
  const data = response.data
  return typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string' ? data.message : fallback
}

function SaveOptionCheckbox({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className={`flex min-h-11 cursor-pointer items-center gap-3 text-[13px] text-[var(--color-text)] ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
    <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-surface)] ${checked ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-inverted)]' : 'border-[var(--color-border)] bg-[var(--color-bg-alt)]'}`}>
      {checked && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.2 3.2L13 4.5" /></svg>}
    </span>
    <span>{label}</span>
  </label>
}

export default function AddToCollectionDialog({ postId, title, onClose, returnFocusRef, saveMode = false, isBookmarked = false }: Props) {
  const id = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const [creating, setCreating] = useState(false)
  const [saveInLibrary, setSaveInLibrary] = useState(true)
  const [addToCollection, setAddToCollection] = useState(false)
  const [currentBookmark, setCurrentBookmark] = useState(isBookmarked)
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const collections = useCollectionChoices(!saveMode || addToCollection, postId)
  const selectedCollection = collections.data?.pages.flatMap(page => page.data).find(collection => collection.id === selectedCollectionId)
  const selectedCollectionAlreadyContainsPost = Boolean(selectedCollection?.containsPost)
  const add = useAddCollectionPost()
  const bookmark = useBookmarkPost(postId)
  const create = useCreateCollection({ successMessage: 'Story added to your new collection.' })
  const pending = add.isPending || create.isPending || bookmark.isPending
  const close = () => { if (!pending && !submitting.current) onClose() }
  const dialogRef = useDialogFocus(close, closeRef)
  const updateLibrary = async () => {
    if (saveMode && currentBookmark !== saveInLibrary) {
      await bookmark.mutateAsync(saveInLibrary)
      setCurrentBookmark(saveInLibrary)
    }
  }
  const addTo = async (collectionId: string) => {
    if (submitting.current) return
    submitting.current = true
    try { await updateLibrary(); if (!saveMode || addToCollection) await add.mutateAsync({ collectionId, postId }); onClose() } catch { /* Retain the picker for retry. */ }
    finally { submitting.current = false }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current || name.trim().length < 2) return
    submitting.current = true
    try { await updateLibrary(); await create.mutateAsync({ title: name.trim(), description: description.trim(), visibility, postIds: [postId] }); onClose() } catch { /* Retain entered details for retry. */ }
    finally { submitting.current = false }
  }
  return <ModalLayer onDismiss={close} returnFocusRef={returnFocusRef} aria-labelledby={`${id}-heading`} className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[560px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModalHeader title={saveMode ? 'Save story' : 'Add to collection'} titleId={`${id}-heading`} subtitle={title} onClose={close} closeRef={closeRef} closeLabel={saveMode ? 'Close save story' : 'Close add to collection'} className="-mx-6 -mt-6" />
      <div className="mt-6">
        {saveMode && <div className="space-y-3">
          <SaveOptionCheckbox label="Save in your Library" checked={saveInLibrary} disabled={pending} onChange={setSaveInLibrary} />
          <SaveOptionCheckbox label="Add to a collection" checked={addToCollection} disabled={pending} onChange={setAddToCollection} />
        </div>}
        {bookmark.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">The Library save could not be updated. Try again.</p>}
        {!creating && (!saveMode || addToCollection) && <>
          {collections.isPending && <p role="status" className="text-[13px] text-[var(--color-text-secondary)]">Loading your collections…</p>}
          {collections.isError && <div><p role="alert" className="text-[13px] text-[var(--color-danger)]">Your collections could not be loaded.</p><Button variant="secondary" className="mt-3" disabled={collections.isFetching || pending} aria-busy={collections.isFetching} onClick={() => collections.refetch()}>Try again</Button></div>}
          {!collections.isPending && !collections.isError && <>
            {collections.data?.pages.every(page => page.data.length === 0) && !collections.hasNextPage
              ? <p className="text-[13px] text-[var(--color-text-secondary)]">You have no collections yet.</p>
              : <Select id={`${id}-collection`} label="Choose one of your collections" value={selectedCollectionId}
                onChange={value => { setSelectedCollectionId(value); add.reset() }} disabled={pending} pagination={collections} paginationDisabled={pending}
                options={collections.data?.pages.flatMap(page => page.data).map(collection => ({
                  value: collection.id, label: collection.title, badge: collection.containsPost
                    ? `${collection.visibility[0].toUpperCase()}${collection.visibility.slice(1)} · Already added`
                    : `${collection.visibility[0].toUpperCase()}${collection.visibility.slice(1)}`,
                })) || []} className="max-w-none" />}
          </>}
          {add.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">{errorMessage(add.error, 'The story could not be added. Try again.')}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={() => { add.reset(); setCreating(true) }}>Create new collection</Button><Button disabled={pending || !selectedCollectionId || selectedCollectionAlreadyContainsPost} aria-busy={pending} onClick={() => addTo(selectedCollectionId)}>{selectedCollectionAlreadyContainsPost ? 'Already in collection' : saveMode ? 'Save story' : 'Add to collection'}</Button></div>
        </>}
        {saveMode && !addToCollection && <div className="mt-5 flex justify-end"><Button disabled={pending || (!saveInLibrary && !currentBookmark)} aria-busy={pending} onClick={() => addTo('')}>{saveInLibrary ? 'Save story' : 'Remove from Library'}</Button></div>}
        {creating && <form onSubmit={submit}>
          <label htmlFor={`${id}-name`} className="mb-2 block text-[12px] font-semibold">Title (required)</label>
          <input id={`${id}-name`} required minLength={2} maxLength={100} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={fieldClass} />
          <label htmlFor={`${id}-description`} className="mt-4 mb-2 block text-[12px] font-semibold">Description (optional)</label>
          <textarea id={`${id}-description`} maxLength={500} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={`${fieldClass} min-h-20`} />
          <Select id={`${id}-visibility`} label="Visibility" value={visibility} onChange={setVisibility} disabled={pending} options={[{ value: 'public', label: 'Public' }, { value: 'unlisted', label: 'Unlisted' }, { value: 'private', label: 'Private' }]} className="mt-4 max-w-none" />
          <p className="mt-4 text-[13px] text-[var(--color-text-secondary)]">This story will be the first item in your new collection.</p>
          {create.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">{errorMessage(create.error, 'The collection could not be created. Try again.')}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => setCreating(false)}>Back to collections</Button><Button type="submit" disabled={pending || name.trim().length < 2} aria-busy={create.isPending}>Create collection</Button></div>
        </form>}
      </div>
    </section>
  </ModalLayer>
}
