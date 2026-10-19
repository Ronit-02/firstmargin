import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '@/shared/components/ui/Button'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import useToast from '@/shared/hooks/useToast'
import { deletePost } from '../api/profile'

type Props = { post: { _id: string; title: string }; onClose: () => void }

export default function DeletePostDialog({ post, onClose }: Props) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const remove = useMutation({
    mutationFn: () => deletePost(post._id),
    onSuccess: async () => {
      // Deletion changes discovery, saved lists, counts, and linked-content views.
      await queryClient.invalidateQueries()
      notify('Story deleted.')
      onClose()
    },
  })
  const dismiss = () => { if (!remove.isPending) onClose() }
  const dialogRef = useDialogFocus(dismiss, cancelRef, true)
  const titleId = `delete-post-${post._id}-title`

  return <ModalLayer onDismiss={dismiss} aria-labelledby={titleId} className="flex items-center justify-center p-4 backdrop:bg-black/40">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-menu)]">
      <ModalHeader title="Delete story?" titleId={titleId} onClose={dismiss} closeRef={cancelRef} closeLabel="Cancel delete" className="-mx-6 -mt-6" />
      <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">Permanently delete “{post.title}”? Its comments and pending reports will be deleted, and it will disappear from saved lists. This cannot be undone.</p>
      {remove.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">The story could not be deleted. Please try again.</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={() => remove.mutate()} disabled={remove.isPending} aria-busy={remove.isPending} className="!bg-[var(--color-danger)] !border-[var(--color-danger)]">Delete story</Button>
      </div>
    </section>
  </ModalLayer>
}
