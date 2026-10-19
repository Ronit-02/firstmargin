import { useRef, type KeyboardEvent } from 'react'
import Pill from '@/shared/components/ui/Pill'

type Format = 'article' | 'short' | 'collections' | 'series'
type Props = { value: Format; onChange: (value: Format) => void; controlsId: string; includeCollections?: boolean; includeSeries?: boolean; firstLabel?: string; ariaLabel?: string }

export default function PublishedWritingTabs({ value, onChange, controlsId, includeCollections = false, includeSeries = false, firstLabel = 'Stories', ariaLabel = 'Published writing categories' }: Props) {
  const categories: { value: Format; label: string }[] = [{ value: 'article', label: firstLabel }, { value: 'short', label: 'Shorts' }, ...(includeCollections ? [{ value: 'collections' as const, label: 'Collections' }] : []), ...(includeSeries ? [{ value: 'series' as const, label: 'Series' }] : [])]
  const ref = useRef<HTMLDivElement>(null)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = categories.findIndex(category => category.value === value)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + categories.length) % categories.length
    const category = categories[index]
    if (!category) return
    onChange(category.value)
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus())
  }
  return <div ref={ref} className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label={ariaLabel}>
    {categories.map(category => <Pill key={category.value} label={category.label} role="tab" ariaControls={controlsId} active={value === category.value} tabIndex={value === category.value ? 0 : -1} onKeyDown={handleKeyDown} onClick={() => onChange(category.value)} />)}
  </div>
}
