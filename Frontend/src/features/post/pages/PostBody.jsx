/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- Image load failure is an error event, not a user interaction. */
import { useState } from 'react'
import ImageBox from '@/shared/components/ui/ImageBox'

// Render only the editor's supported inline markers. React escapes the text nodes.
const renderInline = value => {
  const text = String(value || '')
  const parts = []
  const pattern = /(\*\*\*([^*\n]+)\*\*\*|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(match[2] ? <strong key={match.index}><em>{match[2]}</em></strong>
      : match[3] ? <strong key={match.index}>{match[3]}</strong> : <em key={match.index}>{match[4]}</em>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

const isSafeImageUrl = value => {
  if (typeof value !== 'string' || value.length > 2_048) return false

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
      && Boolean(url.hostname)
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

function ImageBlock({ item }) {
  const [hasError, setHasError] = useState(!isSafeImageUrl(item.content))
  const label = item.alt || 'Image unavailable'

  if (hasError) {
    return (
      <div className="mb-6">
        <ImageBox height={96} radius="8px" placeholderLabel={label} fallbackVariant="inline" />
      </div>
    )
  }

  return (
    <div className="mb-6">
      <img
        src={item.content}
        alt={item.alt || ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full rounded-lg"
        onError={() => setHasError(true)}
      />
    </div>
  )
}

const renderBlock = (item, compact) => {
  // const commonProps = { key: item.id };

  switch (item.type) {
    case 'text':
      return (
        <p
          key={item.id}
          className={`${compact ? 'text-[14px] font-light leading-[1.7]' : 'text-[17px] leading-[1.82]'} break-words mb-5 text-(--color-text)`}
          style={{ fontFamily: compact ? 'var(--font-sans)' : 'var(--font-reading)' }}
        >
          {renderInline(item.content)}
        </p>
      );

    case 'h1':
      return (
        <h1
          key={item.id}
          className={`${compact ? 'text-[20px] font-normal leading-[1.35]' : 'text-[28px] font-bold leading-[1.3]'} break-words mb-6 text-(--color-text)`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {renderInline(item.content)}
        </h1>
      );

    case 'h2':
      return (
        <h2
          key={item.id}
          className={`${compact ? 'text-[18px] font-normal leading-[1.4]' : 'text-[24px] font-semibold leading-[1.35]'} break-words mb-5 text-(--color-text)`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {renderInline(item.content)}
        </h2>
      );

    case 'h3':
      return (
        <h3
          key={item.id}
          className={`${compact ? 'text-[16px] font-normal leading-[1.45]' : 'text-[20px] font-semibold leading-[1.4]'} mb-4 text-(--color-text)`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {renderInline(item.content)}
        </h3>
      );

    case 'quote':
      return (
        <blockquote
          key={item.id}
          className="border-l-4 pl-4 italic mb-5 text-(--color-text) opacity-80"
          style={{ fontFamily: compact ? 'var(--font-sans)' : 'var(--font-reading)' }}
        >
          {renderInline(item.content)}
        </blockquote>
      );

    case 'code':
      return (
        <pre
          key={item.id}
          className="font-mono bg-(--color-bg-alt) text-(--color-text) p-4 rounded-lg mb-5 overflow-x-auto text-[13px] leading-[1.7]"
        >
          <code>{item.content}</code>
        </pre>
      );

    case 'image':
      return <ImageBlock key={item.id} item={item} />

    case 'divider':
      return (
        <hr
          key={item.id}
          className="my-8 border-t border-(--color-border)"
        />
      );

    default:
      return null;
  }
};

export default function PostBody({ body, compact = false }) {
  const blocks = Array.isArray(body) ? body : []

  return <div data-reading-body={compact ? 'compact' : 'long-form'}>{blocks.map(block => renderBlock(block, compact))}</div>;
}
