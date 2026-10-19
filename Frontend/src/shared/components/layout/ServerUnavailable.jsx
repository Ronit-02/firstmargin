import Button from '@/shared/components/ui/Button'
import { LogoIcon } from '@/shared/icons'

export default function ServerUnavailable() {
  const tryAgain = () => window.location.reload()

  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-16 text-center sm:px-5" aria-labelledby="server-unavailable-title">
      <section className="w-full max-w-[620px]">
        <span aria-label="firstmargin" className="mb-9 inline-flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-accent)] [&>svg]:h-6 [&>svg]:w-6"><LogoIcon /></span>
        <h1 id="server-unavailable-title" className="text-[clamp(30px,4vw,44px)] font-bold leading-[1.08] tracking-[-0.04em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          firstmargin is temporarily unavailable.
        </h1>
        <p role="alert" className="mx-auto mt-5 max-w-[540px] text-[15px] leading-7 text-[var(--color-text-secondary)]">
          We can’t reach the server right now. Please try again in a moment.
        </p>
        <Button className="mt-7" onClick={tryAgain}>Try again</Button>
      </section>
    </main>
  )
}
