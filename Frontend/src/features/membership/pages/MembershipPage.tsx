import retainRetryView from '@/shared/utils/retainRetryView'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import useAuth from '@/features/auth/hooks/useAuth'
import PageFrame from '@/shared/components/layout/PageFrame'
import Button from '@/shared/components/ui/Button'
import PageHeader from '@/shared/components/ui/PageHeader'
import { startMembershipCheckout } from '../api/membership'
import useEntitlements from '../hooks/useEntitlements'

const benefits = [
  { title: 'Early access', description: 'Read eligible early releases before their public release date.' },
  { title: 'Creator extras', description: 'Explore member updates, process notes, and behind-the-scenes writing shared by creators.' },
  { title: 'Workshops', description: 'Reserve a place in published member workshops, subject to availability and capacity.' },
  { title: 'Story summaries and read aloud', description: 'Get a generated overview of a story or listen using your browser’s read-aloud voices.' },
  { title: 'Direct writer requests', description: 'Send a direct request to an eligible writer. Writers choose which requests to accept.' },
  { title: 'Advanced writer analytics', description: 'Understand your writing’s opens, completions, engagement, and completion rate.' },
  { title: 'AI writing assistance', description: 'Get help with clarity, outlines, titles, and gaps in your draft when the service is available, subject to usage limits.' },
]
const linkClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-[18px] py-2 text-[13px] font-medium'

export default function MembershipPage() {
  const { loggedIn, signIn } = useAuth()
  const isReady = useSelector((state: { auth: { isReady: boolean } }) => state.auth.isReady)
  const entitlements = retainRetryView(useEntitlements(isReady && loggedIn))
  const membership = entitlements.data?.membership
  // Trial/active subscriptions must use management even if their access period has expired.
  const hasSubscription = ['active', 'trialing'].includes(membership?.status)
  const billing = useMutation({
    mutationFn: startMembershipCheckout,
    onSuccess: data => window.location.assign(data.checkoutUrl),
  })
  const billingNotConfigured = isAxiosError(billing.error) && billing.error.response?.data?.code === 'PROVIDER_NOT_CONFIGURED'

  return <PageFrame>
    <PageHeader eyebrow="firstmargin membership" title="Go deeper with the writers you love" description="Become a member for extra ways to read, learn, and connect. Primary stories stay open to everyone." />

    <section aria-labelledby="membership-join-title" className="mb-8 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6 md:p-8">
      <h2 id="membership-join-title" className="text-[18px] font-semibold text-[var(--color-text)]">{hasSubscription ? 'Your membership' : 'firstmargin Pro'}</h2>
      {!hasSubscription && <><p className="mt-2 text-[22px] font-bold text-[var(--color-text)]">₹199<span className="text-[13px] font-normal text-[var(--color-text-secondary)]"> / month</span></p><p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Provisional launch price. Paid signup will be available after payment integration. No payment is taken while billing is unavailable.</p></>}
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{hasSubscription ? 'Explore your member experiences. Manage your subscription from Account or your Profile.' : 'Review the final price and renewal details in checkout before confirming your membership.'}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isReady ? <p role="status" className="text-[13px]">Restoring your session…</p> : !loggedIn ? <button type="button" onClick={signIn} aria-haspopup="dialog" style={{ color: 'var(--color-text-inverted)' }} className={`button-target ${linkClass} bg-[var(--color-accent)]`}>Sign In to join</button> : entitlements.isPending ? <p role="status" className="text-[13px]">Checking your membership…</p> : entitlements.isError ? <><p role="alert" className="text-[13px] text-[var(--color-danger)]">Your membership could not be checked.</p><Button variant="secondary" className="min-h-11 sm:min-h-11" onClick={() => entitlements.refetch()} aria-busy={entitlements.isFetching} disabled={entitlements.isFetching}>Try again</Button></> : <>
          {!hasSubscription && <Button className="min-h-11 sm:min-h-11" disabled={billing.isPending} onClick={() => billing.mutate()} aria-busy={billing.isPending}>Become a member</Button>}
          {hasSubscription && <Link to="/members" className={linkClass}>Open Member Hub</Link>}
        </>}
      </div>
      {!loggedIn && isReady && <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">New here? You can create a free account in the sign-in dialog. After onboarding, return here to join.</p>}
      {billing.isError && <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">{billingNotConfigured ? 'Paid membership is not available yet. Payment integration is coming soon; no payment has been taken.' : 'Membership billing could not be opened. Please try again later.'}</p>}
    </section>

    <section aria-labelledby="membership-perks-title">
      <h2 id="membership-perks-title" className="mb-5 text-[22px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Your member perks</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {benefits.map(benefit => <article key={benefit.title} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h3 className="text-[16px] font-semibold text-[var(--color-text)]">{benefit.title}</h3>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{benefit.description}</p>
        </article>)}
      </div>
      <p className="mt-5 text-[13px] leading-6 text-[var(--color-text-secondary)]">Experiences depend on what writers publish. AI writing assistance also requires the service to be available and is subject to usage limits.</p>
    </section>

    <section aria-labelledby="membership-open-title" className="mt-8 border-t border-[var(--color-border)] pt-8">
      <h2 id="membership-open-title" className="text-[18px] font-semibold text-[var(--color-text)]">Good writing stays open</h2>
      <p className="mt-2 max-w-[720px] text-[13px] leading-6 text-[var(--color-text-secondary)]">You can read public stories for free. A free account lets you save stories, follow writers, ask questions, and publish. Membership adds optional extras, and supporting an individual writer is a separate choice.</p>
      <Link to="/explore/trending" className="mt-4 inline-flex min-h-11 items-center text-[13px] underline underline-offset-4">Explore stories</Link>
    </section>
  </PageFrame>
}
