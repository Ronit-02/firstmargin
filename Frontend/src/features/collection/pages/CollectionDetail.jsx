import retainRetryView from '@/shared/utils/retainRetryView'
import { useEffect, useRef, useState } from 'react'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '@/shared/components/ui/Avatar'
import Button from '@/shared/components/ui/Button'
import Pill from '@/shared/components/ui/Pill'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import useFilePickerDismissGuard from '@/shared/hooks/useFilePickerDismissGuard'
import useFilterSearchParams from '@/shared/hooks/useFilterSearchParams'
import { BookmarkIcon, PenIcon, ShareIcon } from '@/shared/icons'
import DiscoveryPostCard from '@/features/discovery/components/DiscoveryPostCard'
import ShortCard from '@/features/discovery/components/ShortCard'
import useAuth from '@/features/auth/hooks/useAuth'
import { useCollection, useCollectionSave, useDeleteCollection, useUpdateCollection, useUploadCollectionCover } from '../hooks/useCollections'
import { ListSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import MissingResourceState from '@/shared/components/ui/MissingResourceState'
import isMissingResourceError from '@/shared/errors/isMissingResourceError'
import PageFrame from '@/shared/components/layout/PageFrame'
import ImageBox from '@/shared/components/ui/ImageBox'
import Select from '@/shared/components/ui/Select'
import isValidImageUrl from '@/shared/utils/isValidImageUrl'

function DeleteCollectionConfirmation({ collection, deletion, triggerRef, onClose, onDeleted }) {
  const closeRef = useRef(null)
  const dismiss = () => { if (!deletion.isPending) onClose() }
  const dialogRef = useDialogFocus(dismiss, closeRef)
  return <ModalLayer onDismiss={dismiss} returnFocusRef={triggerRef} aria-labelledby="collection-delete-title" className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-menu)]">
      <ModalHeader title="Delete collection?" titleId="collection-delete-title" onClose={dismiss} closeLabel="Close delete collection" closeRef={closeRef} className="-mx-6 -mt-6" />
      <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">This permanently removes “{collection.title}”. Stories in the collection are not deleted.</p>
      {deletion.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">Could not delete collection. Try again.</p>}
      <div className="mt-6 flex justify-end"><Button onClick={() => deletion.mutate(undefined, { onSuccess: onDeleted })} disabled={deletion.isPending} aria-busy={deletion.isPending} className="!bg-[var(--color-danger)] !border-[var(--color-danger)]">Delete collection</Button></div>
    </section>
  </ModalLayer>
}

function EditCollectionDialog({ collection, posts, onClose, returnFocusRef }) {
  const navigate = useNavigate()
  const closeRef = useRef(null)
  const deleteTriggerRef = useRef(null)
  const [title, setTitle] = useState(collection.title)
  const [description, setDescription] = useState(collection.description || '')
  const [coverImage] = useState(collection.coverImage || '')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverSource, setCoverSource] = useState('upload')
  const [coverUrl, setCoverUrl] = useState('')
  const [removeCover, setRemoveCover] = useState(false)
  const coverInputRef = useRef(null)
  const { pickerActiveRef, openPicker, releasePicker } = useFilePickerDismissGuard()
  const uploadCover = useUploadCollectionCover(collection.id)
  const [editedPosts, setEditedPosts] = useState(posts)
  const update = useUpdateCollection(collection.id)
  const deletion = useDeleteCollection(collection.id)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    if (!coverPreview) return undefined
    return () => URL.revokeObjectURL(coverPreview)
  }, [coverPreview])
  const close = () => { if (!pickerActiveRef.current && !update.isPending && !uploadCover.isPending && !deletion.isPending && !confirmDelete) onClose() }
  const dialogRef = useDialogFocus(close, closeRef)
  const submit = async event => { event.preventDefault(); if (title.trim().length < 2 || update.isPending || uploadCover.isPending || deletion.isPending || confirmDelete) return; try { await update.mutateAsync({ title: title.trim(), description: description.trim(), publicationIds: editedPosts.map(post => post.id), ...(coverFile || removeCover ? { coverImage: '' } : coverSource === 'url' && coverUrl.trim() ? { coverImage: coverUrl.trim() } : {}) }); if (coverFile) { try { await uploadCover.mutateAsync(coverFile) } catch { /* The collection details were saved with the standard cover. */ } } onClose() } catch { /* Keep the dialog open for a failed details save. */ } }
  const chooseCover = event => { const file = event.target.files?.[0]; event.target.value = ''; releasePicker(); if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); setRemoveCover(false) } }
  return <ModalLayer onDismiss={close} returnFocusRef={returnFocusRef} aria-labelledby="collection-edit-title" className="grid place-items-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[620px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModalHeader title="Edit collection" titleId="collection-edit-title" subtitle={collection.title} onClose={close} closeRef={closeRef} closeLabel="Close edit collection" className="-mx-6 -mt-6" />
      <form className="mt-6" onSubmit={submit}>
        <div className="mb-5">
          <p className="mb-3 text-[12px] font-semibold text-[var(--color-text)]">Collection image <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span></p>
          <Select id="collection-cover-source" label="Image source" value={coverSource} options={[{ value: 'upload', label: 'Upload file' }, { value: 'url', label: 'Paste URL' }]} onChange={value => { setCoverSource(value); setCoverFile(null); setCoverPreview(null); setCoverUrl('') }} className="mb-3 max-w-none" />
          {coverSource === 'url' && <label className="mb-3 block text-[12px]" htmlFor="collection-cover-url">Image URL<input id="collection-cover-url" type="url" value={coverUrl} onChange={event => { setCoverUrl(event.target.value); if (event.target.value) setRemoveCover(false) }} placeholder="https://..." className="mt-1 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]" /></label>}
          {(coverSource === 'url' ? coverUrl || (removeCover ? '' : coverImage) : coverPreview || (removeCover ? '' : coverImage)) ? <div className="relative"><img src={coverSource === 'url' ? coverUrl || (removeCover ? '' : coverImage) : coverPreview || (removeCover ? '' : coverImage)} alt="Collection cover preview" className="block h-40 w-full rounded-[14px] object-cover" /><button type="button" aria-label="Remove collection image" disabled={update.isPending || uploadCover.isPending} onClick={() => { setCoverFile(null); setCoverPreview(null); setCoverUrl(''); setRemoveCover(true) }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border-none bg-black/60 text-[18px] text-white disabled:opacity-60">×</button></div> : coverSource === 'upload' ? <button type="button" onClick={() => openPicker(coverInputRef.current)} disabled={update.isPending || uploadCover.isPending} className="flex min-h-40 w-full items-center justify-center rounded-[14px] border-2 border-dashed border-[var(--color-border)] bg-transparent px-3 py-3 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] disabled:opacity-60">+ Add image</button> : null}
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onCancel={releasePicker} onChange={chooseCover} />
        </div>
        <label htmlFor="collection-edit-name" className="mb-2 block text-[12px] font-semibold">Name</label><input id="collection-edit-name" value={title} maxLength={100} disabled={update.isPending} onChange={event => setTitle(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)]" />
        <label htmlFor="collection-edit-description" className="mt-4 mb-2 block text-[12px] font-semibold">Description</label><textarea id="collection-edit-description" value={description} maxLength={500} disabled={update.isPending} onChange={event => setDescription(event.target.value)} className="min-h-20 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2.5 text-[13px] text-[var(--color-text)]" />
        <fieldset className="mt-5"><legend className="mb-2 text-[12px] font-semibold">Stories in this collection</legend>{['article', 'short'].map(format => { const items = editedPosts.filter(post => (post.format === 'short') === (format === 'short')); return <section key={format} className="mb-4 last:mb-0"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{format === 'short' ? 'Shorts' : 'Full stories'}</h3><div className="space-y-2">{items.length ? items.map(post => <div key={post.id} className="flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-2"><span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text)]">{post.title}</span><button type="button" onClick={() => setEditedPosts(current => current.filter(item => item.id !== post.id))} disabled={update.isPending} aria-label={`Remove ${post.title} from collection`} className="button-target min-h-9 rounded-full border border-[var(--color-border)] px-3 text-[12px] text-[var(--color-danger)]">Remove</button></div>) : <p className="text-[13px] text-[var(--color-text-secondary)]">No {format === 'short' ? 'shorts' : 'full stories'} in this collection.</p>}</div></section> })}</fieldset>
        {update.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">The collection could not be updated. Try again.</p>}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3"><Button ref={deleteTriggerRef} type="button" variant="secondary" onClick={() => setConfirmDelete(true)} disabled={update.isPending || uploadCover.isPending || deletion.isPending || confirmDelete} className="!text-[var(--color-danger)]">Delete collection</Button><Button type="submit" disabled={update.isPending || uploadCover.isPending || deletion.isPending || confirmDelete || title.trim().length < 2 || Boolean(coverUrl.trim() && !isValidImageUrl(coverUrl))} aria-busy={update.isPending || uploadCover.isPending}>Save changes</Button></div>
      </form>
    </section>
    {confirmDelete && <DeleteCollectionConfirmation collection={collection} deletion={deletion} triggerRef={deleteTriggerRef} onClose={() => setConfirmDelete(false)} onDeleted={() => navigate('/collections', { replace: true })} />}
  </ModalLayer>
}

export default function CollectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { loggedIn, signIn } = useAuth()
  const [showShare, setShowShare] = useState(false)
  const [showEdit, setShowEdit] = useState(() => Boolean(location.state?.openEditCollection))
  useEffect(() => {
    if (location.state?.openEditCollection) navigate(location.pathname + location.search + location.hash, { replace: true, state: null })
  }, [location.hash, location.pathname, location.search, location.state, navigate])
  const [params, setParams] = useFilterSearchParams()
  const formatFilter = params.get('collectionFormat') === 'shorts' ? 'shorts' : 'stories'
  const setFormatFilter = value => setParams(current => {
    if (value === 'stories') current.delete('collectionFormat')
    else current.set('collectionFormat', value)
    return current
  })
  const editTriggerRef = useRef(null)
  const shareTriggerRef = useRef(null)
  const closeShareMenu = ({ restoreFocus = false } = {}) => {
    setShowShare(false)
    if (restoreFocus) requestAnimationFrame(() => shareTriggerRef.current?.focus())
  }
  const query = retainRetryView(useCollection(id))
  const save = useCollectionSave(id)
  const [orderedPostOverrides, setOrderedPosts] = useState([])
  if (query.isPending) return <PageFrame><div role="status" aria-label="Loading collection"><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="mt-7 h-[clamp(180px,32vw,300px)] w-full rounded-[20px]" /><Skeleton className="mt-7 h-10 w-3/5" /><Skeleton className="mt-4 h-4 w-full max-w-2xl" /><div className="mt-10"><ListSkeleton count={4} role={undefined} /></div></div></PageFrame>
  if (query.isError && isMissingResourceError(query.error)) return <MissingResourceState eyebrow="Collection unavailable" title="This collection is no longer available" detail="It may have been removed, made private, or the link may be incorrect. Explore other collections instead." recoveryTo="/collections" recoveryLabel="Explore collections" />
  if (query.isError) return <PageFrame><div role="alert"><p className="text-[13px] text-[var(--color-danger)]">Collection could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div></PageFrame>
  const collection = query.data
  const saveLabel = collection.isSaved ? 'Remove from saved collections' : 'Save this collection'
  const toggleSave = () => { if (!save.isPending) loggedIn ? save.mutate(!collection.isSaved) : signIn() }
  const orderedPosts = orderedPostOverrides.length ? orderedPostOverrides : collection.posts
  const groups = [
    { id: 'articles', title: 'Full stories', posts: orderedPosts.filter(post => post.format !== 'short') },
    { id: 'shorts', title: 'Shorts', posts: orderedPosts.filter(post => post.format === 'short') },
  ]
  const visibleGroups = groups.filter(group => formatFilter === 'stories' ? group.id === 'articles' : group.id === 'shorts')
  return <PageFrame><div className="grid gap-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:items-center"><div><ImageBox src={collection.coverImage} alt="" height="clamp(160px, 26vw, 240px)" radius="20px" placeholderLabel="Reading collection" fallbackVariant="collection" /></div><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-7"><div className="order-1 col-span-2 min-w-0 max-w-[680px] lg:col-span-1"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">{collection.visibility} collection</span><h1 className="mt-3 text-[clamp(30px,5vw,48px)] leading-[1.05] tracking-[-0.045em] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{collection.title}</h1><p className="mt-4 text-[14px] leading-7 text-[var(--color-text-secondary)]">{collection.description}</p></div><div className="order-3 flex justify-self-end gap-2 lg:order-2 lg:self-start">{!collection.isOwner && <button type="button" onClick={toggleSave} disabled={save.isPending} aria-label={saveLabel} aria-busy={save.isPending} aria-pressed={Boolean(collection.isSaved)} title={saveLabel} className={`flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] transition-all duration-150 disabled:opacity-60 ${collection.isSaved ? 'bg-[var(--color-accent)] text-[var(--color-text-inverted)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}><span aria-hidden="true"><BookmarkIcon filled={collection.isSaved} /></span></button>}{collection.isOwner && <button ref={editTriggerRef} type="button" onClick={() => setShowEdit(true)} aria-label="Edit collection" title="Edit collection" className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"><PenIcon /></button>}<button ref={shareTriggerRef} type="button" onClick={() => setShowShare(value => !value)} aria-expanded={showShare} aria-haspopup="dialog" aria-controls={showShare ? 'collection-share-menu' : undefined} aria-label="Share this collection" title="Share this collection" className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-all"><ShareIcon /></button>{showShare && <ShareMenu anchorRef={shareTriggerRef} onClose={closeShareMenu} id="collection-share-menu" label="Share collection" contentName="Collection" url={`${window.location.origin}/collections/${id}`} />}</div><Link to={collection.author.handle ? `/author/${encodeURIComponent(collection.author.handle)}` : '/author'} aria-label={`View ${collection.author.username}'s profile`} className="order-2 flex min-w-0 items-center gap-3 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 lg:order-3"><Avatar src={collection.author.picture} name={collection.author.username} size={32} /><div><p className="text-[12px] font-semibold text-[var(--color-text)]">Curated by {collection.author.username}</p><p className="text-[11px] text-[var(--color-text-muted)]">{collection.postsCount} stories · {collection.savedCount} saves · {collection.followersCount} followers</p></div></Link></div></div>{save.isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">The collection action could not be updated.</p>}<section className="mt-10 border-t border-[var(--color-border)] pt-8"><div className="mb-7 flex items-center justify-between gap-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Collection format"><Pill label="Stories" active={formatFilter === 'stories'} onClick={() => setFormatFilter('stories')} /><Pill label="Shorts" active={formatFilter === 'shorts'} onClick={() => setFormatFilter('shorts')} /></div>{collection.isOwner && <div className="flex items-center gap-3"></div>}</div>{visibleGroups.map(group => group.posts.length > 0 && <section key={group.id} aria-labelledby={`collection-${group.id}-title`} className="mb-8">
      <h3 id={`collection-${group.id}-title`} className="mb-5 text-[18px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{group.title}</h3>
      <div className={group.id === 'shorts' ? 'card-grid card-grid--short items-start gap-4' : undefined}>
        {group.posts.map((post, index) => <div key={post.id} className="relative min-w-0">
          {group.id === 'shorts' ? <ShortCard post={post} fluid /> : <DiscoveryPostCard post={post} flushTop={index === 0} />}
        </div>)}
      </div>
    </section>)} {orderedPosts.length === 0 && <p className="py-10 text-[13px] text-[var(--color-text-muted)]">This collection is empty.</p>}</section>{showEdit && collection.isOwner && <EditCollectionDialog collection={collection} posts={orderedPosts} returnFocusRef={editTriggerRef} onClose={() => { setShowEdit(false); setOrderedPosts([]) }} />}</PageFrame>
}
