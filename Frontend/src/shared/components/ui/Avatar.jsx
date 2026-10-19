/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- Image loading failures must switch to the accessible abstract fallback. */
import { useState } from 'react'

export default function Avatar({ src, name = '', size = 32 }) {
  const px = `${size}px`
  const seed = [...name].reduce((value, character) => value * 31 + character.charCodeAt(0), 0) >>> 0
  const offset = 14 + seed % 36
  const rotation = seed % 4 * 45
  const [failedSrc, setFailedSrc] = useState(null)

  if (src && src !== failedSrc) {
    return (
      <img
        src={src} alt={name} loading="lazy" onError={() => setFailedSrc(src)}
        className="rounded-full object-cover shrink-0 border border-[var(--color-border-light)] block"
        style={{ width: px, height: px }}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={name ? `${name} avatar` : 'Profile avatar'}
      className="rounded-full bg-[var(--color-bg-alt)] shrink-0 overflow-hidden"
      style={{ width: px, height: px }}
    >
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-full w-full" style={{ transform: `rotate(${rotation}deg)` }}>
        <circle cx={offset} cy="24" r="20" fill="var(--color-accent)" fillOpacity=".2" />
        <path d="M-5 48Q18 18 69 42" fill="none" stroke="var(--color-accent)" strokeOpacity=".6" strokeWidth="5" />
        <path d="M-5 59Q18 29 69 53" fill="none" stroke="var(--color-border)" strokeWidth="10" />
      </svg>
    </div>
  )
}
