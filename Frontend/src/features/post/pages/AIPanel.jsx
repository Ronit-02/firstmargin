import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchPostSummary, startMembershipCheckout } from '@/features/membership/api/membership'
import Button from '@/shared/components/ui/Button'
import IconButton from '@/shared/components/ui/IconButton'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useDialogFocus from '@/shared/hooks/useDialogFocus'

const SummaryIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const AudioIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 010 7.07" />
  </svg>
)

export function AIStickyButtons({ onSummary, onAudio, showSummary, readAloud, summaryRef, audioRef }) {
  return (
    <div role="group" aria-label="Story tools" className="flex flex-row flex-wrap gap-[10px] xl:sticky xl:top-20 xl:flex-col">
      {[
        { fn: onSummary, active: showSummary, icon: <SummaryIcon />, title: 'Story overview', ref: summaryRef },
        { fn: onAudio, active: readAloud, icon: <AudioIcon />, title: 'Read aloud', ref: audioRef },
      ].map(button => (
        <Button key={button.title} ref={button.ref} onClick={button.fn} title={button.title} aria-label={button.title} aria-pressed={button.active}
          variant={button.active ? 'primary' : 'secondary'} leadingIcon={button.icon}
          className="!px-3 xl:!p-0 xl:!w-11 hover:opacity-80">
          <span className="xl:hidden">{button.title}</span>
        </Button>
      ))}
    </div>
  )
}

export function AccessPanel({ capability, onClose = () => {}, returnFocusRef }) {
  const isSummary = capability === 'article_summary'
  const closeRef = useRef(null)
  const dialogRef = useDialogFocus(onClose, closeRef, true, false)
  const checkout = useMutation({ mutationFn: startMembershipCheckout, onSuccess: data => window.location.assign(data.checkoutUrl) })
  return (
    <ModalLayer onDismiss={onClose} returnFocusRef={returnFocusRef} aria-labelledby="article-member-feature-title" className="grid place-items-center p-4">
      <section ref={dialogRef} tabIndex={-1} className="w-full max-w-[420px] overflow-y-auto rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
        <ModalHeader title="Member feature" titleId="article-member-feature-title" onClose={onClose} closeLabel="Close member feature" closeRef={closeRef} />
        <div className="p-5 sm:p-6">
          <p className="text-[13px] leading-[1.65] text-[var(--color-text-secondary)]">
            {isSummary ? 'Story overviews' : 'Read aloud'} is included with a firstmargin membership. The full story always remains free to read.
          </p>
          <div className="mt-4 flex justify-end">
            <Button size="sm" disabled={checkout.isPending} onClick={() => checkout.mutate()} aria-busy={checkout.isPending}>
              Become a member
            </Button>
          </div>
          {checkout.isError && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">{checkout.error?.response?.data?.message || 'Billing is temporarily unavailable.'}</p>}
        </div>
      </section>
    </ModalLayer>
  )
}

export function SummaryPanel({ postId }) {
  const summary = useQuery({
    queryKey: ['post-summary', postId],
    queryFn: () => fetchPostSummary(postId),
    enabled: Boolean(postId),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  return (
    <section aria-live="polite" className="mt-6 p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px]">
      <p className="font-semibold text-[14px] mb-[14px] text-[var(--color-text)]">Story overview</p>
      {summary.isLoading && <p className="text-[13px] text-[var(--color-text-muted)]">Preparing an overview…</p>}
      {summary.isError && <p role="alert" className="text-[13px] text-[var(--color-danger)]">We couldn’t prepare this overview. Please try again.</p>}
      {summary.data && (
        <>
          <ul className="flex flex-col gap-2 list-disc pl-5">
            {summary.data.points.map((point, index) => (
              <li key={`${index}-${point.slice(0, 20)}`} className="text-[13px] text-[var(--color-text-secondary)] leading-[1.7]">{point}</li>
            ))}
          </ul>
          <p className="mt-4 pt-3 border-t border-[var(--color-border)] text-[10px] leading-[1.5] text-[var(--color-text-muted)]">{summary.data.disclosure}</p>
        </>
      )}
    </section>
  )
}

const formatTime = seconds => {
  const value = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export function ReadAloudPanel({ text }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const utteranceRef = useRef(null)
  const timerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text])
  const estimatedSeconds = Math.max(1, Math.round(words / 2.5))

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    utteranceRef.current = null
    setPlaying(false)
  }, [supported])

  useEffect(() => stop, [stop])

  const play = () => {
    if (!supported || !text.trim()) return
    if (playing) {
      window.speechSynthesis.pause()
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      setPlaying(false)
      return
    }
    if (window.speechSynthesis.paused && utteranceRef.current) {
      window.speechSynthesis.resume()
    } else {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.onend = () => { setElapsed(estimatedSeconds); stop() }
      utterance.onerror = stop
      utteranceRef.current = utterance
      setElapsed(0)
      window.speechSynthesis.speak(utterance)
    }
    timerRef.current = window.setInterval(() => setElapsed(value => Math.min(estimatedSeconds, value + 1)), 1000)
    setPlaying(true)
  }

  const restart = () => { stop(); setElapsed(0) }

  return (
    <section className="mt-6 px-5 py-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px]">
      <div className="flex items-center gap-4">
        <IconButton variant="primary" onClick={play} disabled={!supported || !text.trim()} label={playing ? 'Pause reading' : 'Read story aloud'}
          icon={playing ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
        <div className="flex-1">
          <p className="text-[12px] text-[var(--color-text-muted)] mb-[6px]">Browser read aloud</p>
          <div className="h-1 bg-[var(--color-bg-alt)] rounded-full" role="progressbar" aria-valuemin="0" aria-valuemax={estimatedSeconds} aria-valuenow={elapsed}>
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-[width]" style={{ width: `${Math.min(100, elapsed / estimatedSeconds * 100)}%` }} />
          </div>
        </div>
        <span className="text-[12px] text-[var(--color-text-muted)] flex-shrink-0">{formatTime(elapsed)} / ≈{formatTime(estimatedSeconds)}</span>
      </div>
      {!supported && <p role="alert" className="mt-3 text-[11px] text-[var(--color-danger)]">Read aloud is not supported by this browser.</p>}
      {elapsed > 0 && <button type="button" onClick={restart} className="button-target mt-3 text-[11px] font-semibold text-[var(--color-accent)]">Restart</button>}
    </section>
  )
}
