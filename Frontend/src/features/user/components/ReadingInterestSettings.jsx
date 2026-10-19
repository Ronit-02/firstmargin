import { Skeleton } from '@/shared/components/ui/Skeleton'
import StepInterests from '@/features/onboarding/pages/StepInterests'
import Button from '@/shared/components/ui/Button'

export default function ReadingInterestSettings({ options, selected, onToggle, resetRequested, onToggleReset }) {
  return <>
    <section className="py-7">
      <h2 className="text-[18px] font-semibold text-[var(--color-text)]">Reading interests</h2>
      <p className="mt-2 mb-6 text-[13px] leading-6 text-[var(--color-text-secondary)]">These explicit choices influence your For You feed. They are used for recommendations, not sold or used for advertising.</p>
      {options.isPending && <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
      {options.isError && <p role="alert" className="text-[13px] text-[var(--color-danger)]">Topics could not be loaded.</p>}
      {Array.isArray(options.data?.topics) && <StepInterests topics={options.data.topics} selected={selected} onToggle={onToggle} />}
    </section>
    <section className="py-7">
      <h2 className="text-[18px] font-semibold text-[var(--color-text)]">Inferred interests</h2>
      <p className="mt-2 mb-5 text-[13px] leading-6 text-[var(--color-text-secondary)]">firstmargin can learn from reading interactions. Resetting removes those learned weights without changing the topics you selected above.</p>
      <Button type="button" variant="secondary" onClick={onToggleReset} aria-pressed={resetRequested}>{resetRequested ? 'Undo reset' : 'Reset inferred interests'}</Button>
      {resetRequested && <p role="status" className="mt-3 text-[12px] text-[var(--color-text-secondary)]">Inferred interests will reset when you save.</p>}
    </section>
  </>
}
