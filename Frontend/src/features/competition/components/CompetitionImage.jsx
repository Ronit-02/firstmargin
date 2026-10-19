import ImageBox from '@/shared/components/ui/ImageBox'

export default function CompetitionImage({ src, title, status, height = 80, radius = '10px' }) {
  const label = title ? `${title} competition cover` : 'Competition cover'
  const fallbackLabel = status ? `${label}, ${status}` : label
  return <ImageBox src={src} alt={label} height={height} radius={radius} placeholderLabel={fallbackLabel} fallbackVariant="competition" />
}
