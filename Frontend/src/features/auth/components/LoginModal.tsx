import ModalHeader from '@/shared/components/ui/ModalHeader'
import { useId } from 'react'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import Login from '../pages/Login'

type Props = { onClose: () => void; returnTo: string }

export default function LoginModal({ onClose, returnTo }: Props) {
  const titleId = useId()
  const panelRef = useDialogFocus(onClose)
  return <ModalLayer aria-labelledby={titleId} onDismiss={onClose} className="flex items-center justify-center p-4">
    <section ref={panelRef} tabIndex={-1} className="w-full max-w-95 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
      <ModalHeader title="Sign in to firstmargin" titleId={titleId} onClose={onClose} closeLabel="Close sign-in dialog" />
      <Login embedded returnTo={returnTo} onSignedIn={onClose} />
    </section>
  </ModalLayer>
}
