import ModalHeader from '@/shared/components/ui/ModalHeader'
import { useId, type ReactNode, type RefObject } from 'react'
import ModalLayer from './ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'

export type ReportSubject = 'post' | 'short' | 'collection' | 'author' | 'question' | 'answer' | 'comment'

export const reportTitle = (subject: ReportSubject) => `Report this ${subject === 'post' ? 'story' : subject}`

type Props = { title: string; onClose: () => void; children: ReactNode; returnFocusRef?: RefObject<HTMLElement> }

export default function ReportModal({ title, onClose, children, returnFocusRef }: Props) {
  const titleId = useId()
  const panelRef = useDialogFocus(onClose)
  return <ModalLayer aria-labelledby={titleId} onDismiss={onClose} returnFocusRef={returnFocusRef} className="flex items-center justify-center p-4">
    <section ref={panelRef} tabIndex={-1} className="w-full max-w-[560px] overflow-y-auto rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)]">
      <ModalHeader title={title} titleId={titleId} onClose={onClose} closeLabel="Close report dialog" className="-mx-5 -mt-5 mb-4" />
      {children}
    </section>
  </ModalLayer>
}
