import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '@/shared/components/ui/Button'
import Select from '@/shared/components/ui/Select'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useToast from '@/shared/hooks/useToast'
import useFilePickerDismissGuard from '@/shared/hooks/useFilePickerDismissGuard'
import isValidImageUrl from '@/shared/utils/isValidImageUrl'
import { updateMyProfileCover } from '../api/profile'
import ProfileCover from './ProfileCover'

type Props = { coverImageUrl?: string | null; handle: string | null }

export default function ProfileCoverEditor({ coverImageUrl, handle }: Props) {
  const [savedUrl, setSavedUrl] = useState(coverImageUrl || null)
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('upload')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [remove, setRemove] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { pickerActiveRef, openPicker, releasePicker } = useFilePickerDismissGuard()
  const client = useQueryClient()
  const { notify } = useToast()
  const update = useMutation({ mutationFn: (image: File | string | null) => updateMyProfileCover(image) })

  useEffect(() => {
    if (!file) { setPreview(null); return undefined }
    const next = URL.createObjectURL(file)
    setPreview(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  const reset = () => {
    setFile(null); setUrl(''); setRemove(false); setError('')
    if (inputRef.current) inputRef.current.value = ''
  }
  const close = () => {
    if (update.isPending || pickerActiveRef.current) return
    reset(); setOpen(false)
  }
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    releasePicker()
    const selected = event.currentTarget.files?.[0]
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(selected.type) || selected.size > 8 * 1024 * 1024) {
      setError('Choose a JPG, PNG, WebP, or GIF no larger than 8 MB.')
      setFile(null); event.currentTarget.value = ''; return
    }
    setError(''); setFile(selected); setUrl(''); setRemove(false)
  }
  const canSave = remove || (source === 'url' ? isValidImageUrl(url) : Boolean(file))
  const save = async () => {
    if (!canSave || update.isPending) return
    setError('')
    try {
      const updated = await update.mutateAsync(remove ? null : source === 'url' ? url.trim() : file)
      setSavedUrl(updated.coverImageUrl)
      client.setQueryData(['me', 'profile'], (current: Record<string, unknown> | undefined) => current ? { ...current, coverImageUrl: updated.coverImageUrl } : current)
      await client.invalidateQueries({ queryKey: ['me', 'profile'] })
      if (handle) await client.invalidateQueries({ queryKey: ['writer', handle] })
      reset(); setOpen(false)
      notify('Cover image updated.')
    } catch {
      const message = 'Cover image could not be saved. Please try again.'
      setError(message); notify(message, { tone: 'error' })
    }
  }
  const displayed = remove ? null : source === 'url' ? isValidImageUrl(url) ? url.trim() : savedUrl : preview || savedUrl
  return <section className="mb-7">
    <p className="mb-2 text-[11px] font-semibold text-[var(--color-text-muted)]">Cover image</p>
    <button ref={triggerRef} type="button" aria-label="Edit cover image" title="Edit cover image" onClick={() => setOpen(true)} className="block w-full rounded-b-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2"><ProfileCover src={savedUrl} /></button>
    <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">Click your cover image to replace it.</p>
    {open && <ModalLayer onDismiss={close} returnFocusRef={triggerRef} aria-labelledby="profile-cover-title" className="flex items-center justify-center p-4">
      <section className="w-full max-w-[640px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
        <ModalHeader title="Cover image" titleId="profile-cover-title" onClose={close} closeLabel="Close cover image" />
        <div className="p-5">
          <Select id="profile-cover-source" label="Image source" value={source} disabled={update.isPending} options={[{ value: 'upload', label: 'Upload file' }, { value: 'url', label: 'Paste URL' }]} onChange={value => { reset(); setSource(value) }} className="max-w-none" />
          <div className="relative mt-4"><ProfileCover src={displayed} />{displayed && <button type="button" aria-label="Remove cover image" disabled={update.isPending} onClick={() => { reset(); setRemove(true) }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border-none bg-black/60 text-[18px] text-white disabled:opacity-60">×</button>}</div>
          <input ref={inputRef} type="file" aria-label="Cover image file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={update.isPending} onCancel={releasePicker} onChange={choose} className="sr-only" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {source === 'upload' ? <Button type="button" variant="secondary" disabled={update.isPending} onClick={() => openPicker(inputRef.current)}>Replace</Button> : <input type="url" aria-label="Cover image URL" disabled={update.isPending} value={url} onChange={event => { setUrl(event.target.value); if (event.target.value) setRemove(false) }} placeholder="https://..." className="min-w-0 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 text-[13px]" />}
            <Button type="button" disabled={!canSave || update.isPending} onClick={save} aria-busy={update.isPending}>Save</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-center text-xs font-semibold text-[var(--color-danger)]">{error}</p>}
          <p className="mt-3 text-center text-[11px] text-[var(--color-text-muted)]">JPG, PNG, WebP, or GIF, up to 8 MB.</p>
        </div>
      </section>
    </ModalLayer>}
  </section>
}
