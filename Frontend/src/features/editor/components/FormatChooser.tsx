import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'

type Format = 'article' | 'short'

export default function FormatChooser({ loggedIn, onClose }: { loggedIn: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const firstChoice = useRef<HTMLButtonElement>(null)
  const dismiss = () => onClose()
  const dialogRef = useDialogFocus(dismiss, firstChoice)
  const choose = async (format: Format) => {
    navigate(`/studio?new=${format}${location.hash}`)
  }
  return <ModalLayer onDismiss={dismiss} aria-labelledby="write-format-title" className="flex items-center justify-center p-4">
    <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
      <ModalHeader title="What do you want to write?" titleId="write-format-title" closeLabel="Close writing choices" onClose={dismiss} />
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <button ref={firstChoice} type="button" onClick={() => choose('article')} className="min-h-11 rounded-[10px] border border-[var(--color-border)] p-4 text-left hover:bg-[var(--color-bg-alt)]"><span className="block text-[14px] font-semibold">Story</span><span className="mt-1 block text-[13px] text-[var(--color-text-secondary)]">A full story with a cover image.</span></button>
        <button type="button" onClick={() => choose('short')} className="min-h-11 rounded-[10px] border border-[var(--color-border)] p-4 text-left hover:bg-[var(--color-bg-alt)]"><span className="block text-[14px] font-semibold">Short</span><span className="mt-1 block text-[13px] text-[var(--color-text-secondary)]">A focused idea within 500 words.</span></button>
      </div>
    </section>
  </ModalLayer>
}
