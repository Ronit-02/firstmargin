import { Link } from 'react-router-dom'
import AuthorMeta from '@/shared/components/ui/AuthorMeta'

type ReadingHistoryItem = {
  id: string
  title: string
  author?: { username: string; handle?: string | null; picture?: string | null }
  lastReadAt: string
  readTime?: string
  progress: number
  completed?: boolean
}

export default function ReadingHistoryCard({ item }: { item: ReadingHistoryItem }) {
  return (
    <article className="relative border-b border-[var(--color-border)] py-5">
      <div className="relative z-10 min-w-0 [&>div]:gap-2">
        <AuthorMeta author={item.author} date={item.lastReadAt} readTime={item.readTime} stacked />
      </div>
      <h2 className="mt-3 line-clamp-2 break-words text-[17px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
        <Link to={`/post/${item.id}`} state={{ readingProgress: item.progress }} className="rounded-[4px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">{item.title}</Link>
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 max-w-64 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-alt)]">
          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${item.progress}%` }} />
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)]">{item.completed ? 'Completed' : item.progress ? `${item.progress}% read` : 'Opened'}</span>
      </div>
    </article>
  )
}
