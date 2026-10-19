import { useRef } from 'react'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'

type Option = { type: string; label: string; icon: string }
type Props = { options: Option[]; onSelect: (option: Option) => void; onClose: () => void; title: string }

export default function MobileBlockMenu({ options, onSelect, onClose, title }: Props) {
  const first = useRef<HTMLButtonElement>(null)
  const panel = useDialogFocus(onClose, first)
  return <ModalLayer onDismiss={onClose} onPointerDown={event => {
    if (event.target === event.currentTarget) {
      event.preventDefault()
      onClose()
    }
  }} aria-labelledby="mobile-block-title" className="flex items-end justify-center px-0 pt-4">
    <button type="button" tabIndex={-1} aria-label="Dismiss block options" onClick={onClose}
      className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent" />
    <section ref={panel} tabIndex={-1} className="relative z-10 flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
      <ModalHeader title={title} titleId="mobile-block-title" onClose={onClose} closeLabel="Close block options" />
      <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{options.map((option, index) => <button key={option.type} ref={index === 0 ? first : undefined} type="button" onClick={() => onSelect(option)} className="flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] hover:bg-[var(--color-bg-alt)]"><span aria-hidden="true" className="w-8 text-center">{option.icon}</span>{option.label}</button>)}</div>
    </section>
  </ModalLayer>
}
