/* eslint-disable react-hooks/set-state-in-effect, jsx-a11y/no-noninteractive-element-interactions -- Source changes reset image failure state; image load failure is not a user interaction. */
/* ImageBox — lazy-loaded image container with configurable radius */
import { useEffect, useState } from 'react'

function AbstractCover({ variant }) {
  return <svg aria-hidden="true" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full" fill="none">
    {variant === 'collection' ? <>
      <rect x="55" y="38" width="164" height="114" rx="12" fill="var(--color-surface)" stroke="var(--color-border)" />
      <rect x="91" y="24" width="164" height="114" rx="12" fill="var(--color-bg-alt)" stroke="var(--color-border)" />
      <path d="M112 107c28-44 58-58 122-61M112 126c39-35 77-43 122-40" stroke="var(--color-accent)" strokeOpacity=".5" strokeWidth="3" />
    </> : variant === 'series' ? <>
      <path d="M-30 147C49 147 57 26 141 26s91 121 180 121" stroke="var(--color-border)" strokeWidth="32" />
      <path d="M-30 147C49 147 57 26 141 26s91 121 180 121" stroke="var(--color-accent)" strokeOpacity=".55" strokeWidth="2" />
      <circle cx="62" cy="91" r="13" fill="var(--color-surface)" stroke="var(--color-accent)" strokeOpacity=".55" />
      <circle cx="174" cy="47" r="13" fill="var(--color-surface)" stroke="var(--color-accent)" strokeOpacity=".55" />
      <circle cx="273" cy="122" r="13" fill="var(--color-surface)" stroke="var(--color-accent)" strokeOpacity=".55" />
    </> : variant === 'entry' ? <>
      <path d="M-30 180 130 0h77L47 180ZM124 180 284 0h77L201 180Z" fill="var(--color-surface)" />
      <circle cx="160" cy="90" r="45" stroke="var(--color-accent)" strokeOpacity=".55" strokeWidth="2" />
      <circle cx="160" cy="90" r="17" fill="var(--color-accent)" fillOpacity=".18" />
    </> : variant === 'competition' ? <>
      <path d="M-25 165 103-30h70L45 165ZM164 210 292 15h70L234 210Z" fill="var(--color-surface)" />
      <circle cx="165" cy="90" r="62" stroke="var(--color-accent)" strokeOpacity=".45" strokeWidth="2" />
      <circle cx="165" cy="90" r="35" stroke="var(--color-border)" strokeWidth="12" />
    </> : variant === 'inline' ? <>
      <path d="M0 134q80-80 160 0t160 0M0 98q80-80 160 0t160 0" stroke="var(--color-border)" strokeWidth="18" />
      <circle cx="160" cy="90" r="31" fill="var(--color-accent)" fillOpacity=".18" />
      <circle cx="160" cy="90" r="30" stroke="var(--color-accent)" strokeOpacity=".5" strokeWidth="2" />
    </> : <>
      <path d="M-25 151C55 131 66 30 149 45s87 98 196 62" stroke="var(--color-surface)" strokeWidth="74" />
      <path d="M-25 151C55 131 66 30 149 45s87 98 196 62" stroke="var(--color-accent)" strokeOpacity=".55" strokeWidth="2" />
      <circle cx="215" cy="112" r="34" fill="var(--color-accent)" fillOpacity=".13" />
    </>}
  </svg>
}

export default function ImageBox({ src, alt = '', height = 180, aspectRatio, radius = '0px', placeholderLabel = 'Text-only story', fallbackVariant = 'story', style = {} }) {
  const [hasError, setHasError] = useState(false)
  const fluidRatio = Boolean(aspectRatio && height === 'auto')

  useEffect(() => {
    setHasError(false)
  }, [src])

  return (
    <div
      className={`w-full overflow-hidden bg-[var(--color-bg-alt)] shrink-0 ${fluidRatio ? 'relative' : ''}`}
      style={{ height, aspectRatio, borderRadius: radius, ...style }}
    >
      {src && !hasError ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)}
          className={`${fluidRatio ? 'absolute inset-0' : ''} w-full h-full object-cover block`} />
      ) : (
        <div role="img" aria-label={placeholderLabel} className={`${fluidRatio ? 'absolute inset-0' : ''} h-full w-full border-y border-[var(--color-border-subtle)]`}>
          <AbstractCover variant={fallbackVariant} />
        </div>
      )}
    </div>
  )
}
