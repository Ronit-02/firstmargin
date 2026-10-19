import retainRetryView from '@/shared/utils/retainRetryView'
/* eslint-disable react-hooks/set-state-in-effect -- Server-saved choices intentionally initialize the editable onboarding draft. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import BackButton from '@/shared/components/ui/BackButton'
import StepInterests from './StepInterests'
import StepFollow from './StepFollow'
import StepFeatures from './StepFeatures'
import { useOnboardingOptions, useSaveOnboarding } from '../hooks/useOnboarding'

const STEPS = [
  { id: 1, title: 'Pick your interests', subtitle: 'Choose at least three topics to shape your first feed.' },
  { id: 2, title: 'Find your first writers', subtitle: 'Select writers you want to hear from. You can change this later.' },
  { id: 3, title: 'Discover features', subtitle: 'A quick look at how readers and writers shape firstmargin together.' },
]

function ProgressBar({ current, total }) {
  return <div className="flex gap-[6px] mb-8">{Array.from({ length: total }).map((_, index) =>
    <div key={index} className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${index < current ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
  )}</div>
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const options = retainRetryView(useOnboardingOptions())
  const save = useSaveOnboarding()
  const [step, setStep] = useState(1)
  const [interests, setInterests] = useState([])
  const [followed, setFollowed] = useState([])

  useEffect(() => {
    if (options.data?.selectedTopicSlugs) setInterests(options.data.selectedTopicSlugs)
    if (options.data?.followedWriterIds) setFollowed(options.data.followedWriterIds)
  }, [options.data])

  const toggleInterest = slug => setInterests(current => current.includes(slug)
    ? current.filter(value => value !== slug)
    : [...current, slug])
  const toggleFollow = id => setFollowed(current => current.includes(id)
    ? current.filter(value => value !== id)
    : [...current, id])

  const finish = () => {
    save.mutate({
      topicSlugs: interests,
      writerIds: followed,
      completed: true,
    }, { onSuccess: () => navigate('/') })
  }

  if (options.isPending) return <main className="min-h-screen grid place-items-center bg-[var(--color-bg)] text-[13px] text-[var(--color-text-secondary)]">Preparing your firstmargin…</main>
  if (options.isError) return <main className="min-h-screen grid place-items-center bg-[var(--color-bg)] px-6"><div className="text-center"><h1 className="text-[20px] font-semibold text-[var(--color-text)]">Onboarding could not be loaded</h1><p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Your account is safe. Try loading the choices again.</p><Button className="mt-5" onClick={() => options.refetch()} aria-busy={options.isFetching} disabled={options.isFetching}>Try again</Button></div></main>

  const current = STEPS[step - 1]
  const nextDisabled = step === 1 && interests.length < 3

  return (
    <main className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[560px]">
        <p className="font-bold text-[22px] text-center mb-12 tracking-[-0.5px] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>firstmargin</p>
        <ProgressBar current={step} total={STEPS.length} />
        <p className="text-[12px] text-[var(--color-text-muted)] mb-1">Step {step} of {STEPS.length}</p>
        <h1 className="font-bold text-[24px] tracking-[-0.4px] mb-2 text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{current.title}</h1>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-7">{current.subtitle}</p>

        <div className="mb-10 min-h-[260px]">
          {step === 1 && <StepInterests topics={options.data.topics} selected={interests} onToggle={toggleInterest} />}
          {step === 2 && <StepFollow writers={options.data.suggestedWriters} selected={followed} onToggle={toggleFollow} />}
          {step === 3 && <StepFeatures />}
        </div>

        {save.isError && <p role="alert" className="mb-4 text-[12px] text-[var(--color-danger)]">Your choices could not be saved. Please try again.</p>}
        <div className="flex justify-between items-center gap-2">
          {step > 1 ? <BackButton ariaLabel="Back to previous step" onBack={() => setStep(value => value - 1)} disabled={save.isPending} /> : <div />}
          <Button variant="ghost" onClick={finish} disabled={save.isPending} aria-busy={save.isPending}>Skip</Button>
          <Button variant="primary" disabled={nextDisabled || save.isPending}
            onClick={() => step < STEPS.length ? setStep(value => value + 1) : finish()} aria-busy={save.isPending}>
            {step === STEPS.length ? 'Get Started' : 'Next →'}
          </Button>
        </div>
      </div>
    </main>
  )
}
