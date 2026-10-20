import retainRetryView from '@/shared/utils/retainRetryView'
import ShortCard from '@/features/discovery/components/ShortCard'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '@/shared/components/ui/Button'
import { useCompetition, useCompetitions } from '@/features/competition/hooks/useCompetitions'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import PageHeader from '@/shared/components/ui/PageHeader'
import FeaturedPostCard from '../../components/FeaturedPostCard'
import CompetitionImage from '@/features/competition/components/CompetitionImage'
import competitionTypeLabel from '@/features/competition/utils/competitionTypeLabel'
import Pill from '@/shared/components/ui/Pill'
import FilterBar from '@/shared/components/ui/FilterBar'
import { availableFilterOptions } from '@/shared/utils/availableFilterOptions'

const TYPES = [{ id: 'all', label: 'All' }, { id: 'theme', label: 'Theme' }, { id: 'timed', label: 'Timed' }, { id: 'collaborative', label: 'Collaborative' }, { id: 'reader_choice', label: 'Readers’ Choice' }, { id: 'collective_choice', label: 'Collective Choice' }]

const formatDate = value => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be announced'

function CompetitionCard({ competition }) {
  return <Link to={`/explore/competitions/${competition.id}`} className="flex flex-col gap-4 py-6 border-b border-[var(--color-border)] group sm:flex-row sm:gap-4 sm:py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">
    <div className="aspect-video w-full shrink-0 sm:w-[180px] lg:w-[220px]"><CompetitionImage src={competition.coverImage} title={competition.title} status={competition.status} height="100%" /></div>
    <div className="min-w-0 sm:flex-1">
      <div className="flex min-w-0 flex-col items-start justify-center gap-2 sm:mb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
        <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-[var(--color-bg-alt)] text-[12px] sm:text-[10px] font-semibold uppercase text-[var(--color-text-secondary)]">{competition.status}</span>
        <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-[var(--color-bg-alt)] text-[12px] sm:text-[10px] font-semibold text-[var(--color-text-secondary)]">{competitionTypeLabel(competition)}</span>
        <span className="text-[13px] leading-5 text-[var(--color-text-secondary)] sm:text-[11px] sm:leading-normal sm:text-[var(--color-text-muted)]">Voting closes {formatDate(competition.closeDate)} · {competition.entriesCount} entries</span>
      </div>
      <h2 className="min-w-0 break-words text-[20px] leading-snug font-bold text-[var(--color-text)] sm:text-[17px] sm:leading-normal" style={{ fontFamily: 'var(--font-display)' }}>{competition.title}</h2>
      <p className="mt-1 min-w-0 break-words text-[14px] leading-6 text-[var(--color-text-secondary)] sm:line-clamp-2 sm:text-[12px] sm:leading-normal">{competition.description}</p>
    </div>
  </Link>
}

export default function CompetitionsTab() {
  const query = retainRetryView(useCompetitions())
  if (query.isPending) return <ListSkeleton count={4} label="Loading competitions" />
  if (query.isError) return <div role="alert" className="py-12 text-center"><p className="text-[13px] text-[var(--color-danger)]">Competitions could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => query.refetch()} aria-busy={query.isFetching} disabled={query.isFetching}>Try again</Button></div>
  const active = query.data.filter(item => ['open', 'judging'].includes(item.status))
  const past = query.data.filter(item => !active.includes(item))
  return <CompetitionContent active={active} past={past} />
}

function CompetitionContent({ active, past }) {
  const [params, setParams] = useSearchParams()
  const tab = ['active', 'inactive'].includes(params.get('competitionTab')) ? params.get('competitionTab') : 'active'
  const source = tab === 'active' ? active : past
  const typeOptions = availableFilterOptions(TYPES, source, item => [item.competitionType])
  const competitionType = typeOptions.some(option => option.id === params.get('competitionType')) ? params.get('competitionType') : 'all'
  const filteredActive = competitionType === 'all' ? active : active.filter(item => item.competitionType === competitionType)
  const filteredPast = competitionType === 'all' ? past : past.filter(item => item.competitionType === competitionType)
  const winnerCompetition = filteredPast.find(item => item.status === 'closed')
  const winnerQuery = useCompetition(winnerCompetition?.id)
  const winner = winnerQuery.data?.entries?.find(entry => entry.isWinner)
  const visibleCompetitions = tab === 'active' ? filteredActive : filteredPast
  const updateFilter = (key, value, defaultValue) => {
    setParams(current => {
      const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
      return next
    })
  }
  return <div>
    <PageHeader eyebrow="Explore" title="Competitions" description="Recurring prompts for writers and readers to discover something new." />
    {winner?.post && <section className="mb-12">{winner.post.format === 'short' ? <><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Recent winner · {winner.votesCount} reader votes</p><ShortCard post={{ ...winner.post, id: winner.post._id, image: winner.post.coverImage, author: winner.author }} /></> : <FeaturedPostCard post={{ ...winner.post, id: winner.post._id || winner.post.id, image: winner.post.coverImage || winner.post.image, author: winner.author }} label="Recent winner" readerVotes={winner.votesCount} />}</section>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex gap-2"><Pill label="Ongoing" active={tab === 'active'} onClick={() => updateFilter('competitionTab', 'active', 'active')} /><Pill label="Past" active={tab === 'inactive'} onClick={() => updateFilter('competitionTab', 'inactive', 'active')} /></div>
      {typeOptions.length > 2 && <FilterBar label="Competition type" value={competitionType} onChange={value => updateFilter('competitionType', value, 'all')} options={typeOptions} />}
    </div>
    {visibleCompetitions.length ? visibleCompetitions.map(item => <CompetitionCard key={item.id} competition={item} />) : <p className="py-8 text-[13px] text-[var(--color-text-muted)]">No {tab === 'active' ? 'ongoing' : 'past'} competitions match this filter.</p>}
  </div>
}
