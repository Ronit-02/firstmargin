import ModalHeader from '@/shared/components/ui/ModalHeader'
import ShareMenu from '@/shared/components/ui/ShareMenu'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ActionMenu, { ActionMenuTrigger, ActionMenuItem, HideActionIcon } from '@/shared/components/ui/ActionMenu'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ImageBox from '@/shared/components/ui/ImageBox'
import Avatar from '@/shared/components/ui/Avatar'
import useAuth from '@/features/auth/hooks/useAuth'
import { useCollectionSave, useDeleteCollection } from '../hooks/useCollections'
import useToast from '@/shared/hooks/useToast'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import Button from '@/shared/components/ui/Button'
import BookmarkIcon from '@/shared/icons/BookmarkIcon'
import LinkIcon from '@/shared/icons/LinkIcon'
import { PenIcon } from '@/shared/icons'

export default function CollectionCard({ collection }) {
  const navigate = useNavigate()
  const { loggedIn, signIn } = useAuth()
  const { notify } = useToast()
  const save = useCollectionSave(collection.id)
  const remove = useDeleteCollection(collection.id)
  const triggerRef = useRef(null)
  const deleteCloseRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const menuId = `collection-menu-${collection.id}`
  const deleteDialogId = `delete-collection-dialog-${collection.id}`
  const storiesCount = collection.storiesCount ?? collection.postsCount ?? 0
  const shortsCount = collection.shortsCount ?? 0
  const contentCount = [
    storiesCount > 0 && `${storiesCount} ${storiesCount === 1 ? 'story' : 'stories'}`,
    shortsCount > 0 && `${shortsCount} ${shortsCount === 1 ? 'short' : 'shorts'}`,
  ].filter(Boolean).join(' · ') || '0 stories'
  const deleteDialogRef = useDialogFocus(() => setDeleteOpen(false), deleteCloseRef, deleteOpen)
  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const toggleSave = event => {
    event.stopPropagation()
    if (!loggedIn) {
      signIn()
      return
    }
    save.mutate(!collection.isSaved, { onSuccess: () => closeMenu({ restoreFocus: true }) })
  }

  const share = event => { event.stopPropagation(); closeMenu(); setShareOpen(true) }

  const requestDelete = event => {
    event.stopPropagation()
    closeMenu()
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    remove.mutate(undefined, { onSuccess: () => { setDeleteOpen(false); setHidden(true) } })
  }

  if (hidden) return null

  return (
    <article className="collection-card group relative min-w-0 overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="collection-card__layout">
        <div className="collection-card__cover min-w-0 overflow-hidden rounded-[8px] [&>div]:h-full [&>div]:transition-transform [&>div]:duration-200 group-hover:[&>div]:scale-[1.02]"><ImageBox src={collection.coverImage} alt="" height="100%" radius="8px" placeholderLabel="Reading collection" fallbackVariant="collection" /></div>
        <div className="collection-card__content min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 line-clamp-2 [overflow-wrap:anywhere] text-[18px] font-normal leading-[1.3] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}><Link to={`/collections/${collection.id}`} className="rounded-[4px] after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">{collection.title}</Link></h2>
            <div className="relative z-10 -mr-2 -mt-2 shrink-0">
        <ActionMenuTrigger ref={triggerRef} type="button" aria-label={`More options for ${collection.title}`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={event => { event.stopPropagation(); setMenuOpen(value => !value) }} />
        {menuOpen && <ActionMenu anchorRef={triggerRef} onClose={closeMenu} id={menuId} label={`Options for ${collection.title}`}>
          {!collection.isOwner && <ActionMenuItem disabled={save.isPending} aria-busy={save.isPending} icon={<BookmarkIcon filled={collection.isSaved} />} onClick={toggleSave}>{collection.isSaved ? 'Remove from saved' : 'Save collection'}</ActionMenuItem>}
          {collection.isOwner && <ActionMenuItem icon={<PenIcon />} onClick={() => navigate(`/collections/${collection.id}`, { state: { openEditCollection: true } })}>Edit collection</ActionMenuItem>}
          <ActionMenuItem icon={<LinkIcon />} onClick={share}>Share link</ActionMenuItem>
          {collection.isOwner && <ActionMenuItem tone="danger" icon={<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>} onClick={requestDelete}>Delete collection</ActionMenuItem>}
          <ActionMenuItem icon={<HideActionIcon />} onClick={event => { event.stopPropagation(); setHidden(true); setMenuOpen(false); notify('Collection hidden from this list.', { tone: 'info' }) }}>Not interested</ActionMenuItem>
        </ActionMenu>}
            </div>
          </div>
          <p className="mt-3 line-clamp-3 [overflow-wrap:anywhere] text-[13px] leading-5 text-[var(--color-text-secondary)]">{collection.description || 'A curated reading collection.'}</p>
          <div className="collection-card__footer mt-5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--color-border)] pt-3 text-[12px] text-[var(--color-text-secondary)]">
            <span className="shrink-0 whitespace-nowrap">{contentCount}</span><span aria-hidden="true" className="px-1 text-[var(--color-border)]">|</span><Avatar src={collection.author?.picture} name={collection.author?.username || ''} size={24} /><Link to={collection.author?.handle ? `/author/${encodeURIComponent(collection.author.handle)}` : '/author'} className="relative z-[2] min-w-0 [overflow-wrap:anywhere] rounded-[4px] transition-colors hover:!text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">by {collection.author?.username}</Link>
          </div>
        </div>
      </div>
      {shareOpen && <ShareMenu anchorRef={triggerRef} id={`collection-share-${collection.id}`} label="Share collection" contentName="Collection" url={`${window.location.origin}/collections/${collection.id}`} onClose={({ restoreFocus = false } = {}) => { setShareOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()) }} />}
      {deleteOpen && <ModalLayer onDismiss={() => setDeleteOpen(false)} returnFocusRef={triggerRef} aria-labelledby={`${deleteDialogId}-title`} className="flex items-center justify-center p-4 backdrop:bg-black/40">
        <section ref={deleteDialogRef} tabIndex="-1" className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-menu)]">
          <ModalHeader title="Delete collection?" titleId={`${deleteDialogId}-title`} onClose={() => setDeleteOpen(false)} closeLabel="Cancel delete" closeRef={deleteCloseRef} className="-mx-6 -mt-6" />
          <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">This permanently removes “{collection.title}”. Stories in the collection are not deleted.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={confirmDelete} disabled={remove.isPending} className="!bg-[var(--color-danger)] !border-[var(--color-danger)]" aria-busy={remove.isPending}>{'Delete collection'}</Button>
          </div>
        </section>
      </ModalLayer>}
    </article>
  )
}
