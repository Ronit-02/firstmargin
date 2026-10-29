import ModalHeader from '@/shared/components/ui/ModalHeader'
import { useId, useState } from 'react'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import Login from '../pages/Login'

type Props = { onClose: () => void; returnTo: string }

export default function LoginModal({ onClose, returnTo }: Props) {
  const titleId = useId()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const panelRef = useDialogFocus(onClose)
  return <ModalLayer aria-labelledby={titleId} onDismiss={onClose} className="flex items-center justify-center p-4">
    <section ref={panelRef} tabIndex={-1} className="w-full max-w-[440px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
      <ModalHeader title={mode === 'login' ? 'Sign in to firstmargin' : 'Join firstmargin'} titleId={titleId} subtitle={mode === 'login' ? 'Welcome back. Continue your reading and writing.' : 'Create an account to read, write, and connect.'} onClose={onClose} closeLabel={mode === 'login' ? 'Close sign-in dialog' : 'Close sign-up dialog'} />
      <Login embedded returnTo={returnTo} onSignedIn={onClose} onModeChange={setMode} />
    </section>
  </ModalLayer>
}
