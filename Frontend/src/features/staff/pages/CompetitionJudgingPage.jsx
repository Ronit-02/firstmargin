import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageFrame from '@/shared/components/layout/PageFrame'
import { fetchMyProfile } from '@/features/user/api/profile'
import CompetitionOperations from '../components/CompetitionOperations'

export default function CompetitionJudgingPage() {
  const { id } = useParams()
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile })
  if (me.isPending) return <PageFrame><p role="status" className="text-[13px] text-[var(--color-text-muted)]">Verifying staff access…</p></PageFrame>
  if (me.isError) return <PageFrame><p role="alert" className="text-[13px] text-[var(--color-danger)]">Staff access could not be verified.</p></PageFrame>
  if (!['moderator', 'admin'].includes(me.data?.role)) return <PageFrame><h1 className="text-[24px] font-bold text-[var(--color-text)]">Staff access required</h1></PageFrame>
  return <PageFrame className="!pt-8 !pb-20"><CompetitionOperations isAdmin={me.data.role === 'admin'} actorId={me.data.id} initialCompetitionId={id} /></PageFrame>
}
