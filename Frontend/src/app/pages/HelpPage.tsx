import { Link } from 'react-router-dom'
import PageFrame from '@/shared/components/layout/PageFrame'
import PageHeader from '@/shared/components/ui/PageHeader'

const guides = [
  {
    title: 'Discover and read',
    description: 'Find stories in Explore, browse Shorts, or use the search field at the top of any page to find stories and writers. Public stories are free to read.',
    links: [{ label: 'Explore stories', to: '/explore/trending' }, { label: 'Browse Shorts', to: '/shorts' }],
  },
  {
    title: 'Save stories and follow writers',
    description: 'Sign in to save stories and follow writers from their profiles. Saved stories are in your library; your profile brings together your writing and account activity.',
    links: [{ label: 'Open Saved', to: '/saved' }, { label: 'Open your profile', to: '/profile' }],
  },
  {
    title: 'Write and publish',
    description: 'Any signed-in account can write. Open Write to start or continue a draft, preview your work, and publish when it is ready. Keep an eye on the editor’s save status before leaving.',
    links: [{ label: 'Start writing', to: '/studio' }],
  },
  {
    title: 'Ask questions and participate',
    description: 'Browse reader questions, support questions you want answered, or ask your own after signing in. Writers can respond in the discussion or with a linked story. Competition pages explain their rules, deadlines, and available actions.',
    links: [{ label: 'Reader questions', to: '/explore/questions' }, { label: 'Writing competitions', to: '/explore/competitions' }],
  },
  {
    title: 'Understand membership',
    description: 'Membership adds optional experiences such as early releases, creator extras, workshops, summaries, and read aloud. Check the membership page for perks and joining options. Primary stories remain public, and individual writer support is separate.',
    links: [{ label: 'Membership perks', to: '/membership' }],
  },
  {
    title: 'Manage your settings',
    description: 'Choose Light, Dark, or Use system theme in Settings. English is the currently available language. Sign in to manage reading interests. On smaller screens, open Account in the bottom navigation to find Settings and account actions.',
    links: [{ label: 'Open Settings', to: '/settings' }],
  },
]

export default function HelpPage() {
  return <PageFrame>
    <PageHeader eyebrow="Getting started" title="Help" description="Find your way around firstmargin, from your first read to publishing and membership." />
    <div className="max-w-[720px]">
      {guides.map(guide => <section key={guide.title} className="border-b border-[var(--color-border)] py-6 first:pt-0" aria-label={guide.title}>
        <h2 className="text-[18px] font-semibold text-[var(--color-text)]">{guide.title}</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{guide.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {guide.links.map(link => <Link key={link.to} to={link.to} className="inline-flex min-h-11 items-center text-[13px] underline underline-offset-4">{link.label}</Link>)}
        </div>
      </section>)}
      <section className="pt-6" aria-labelledby="help-recovery-title">
        <h2 id="help-recovery-title" className="text-[18px] font-semibold text-[var(--color-text)]">When something goes wrong</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Use the page’s retry action if content fails to load. If a story is unavailable, return to Explore to find another read. Use Report where available on stories, comments, or questions to flag a concern for review.</p>
        <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-[13px] underline underline-offset-4">Open Home</Link>
      </section>
    </div>
  </PageFrame>
}
