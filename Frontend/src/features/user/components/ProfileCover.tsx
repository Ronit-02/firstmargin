import type { ReactNode } from 'react'

type Props = { src?: string | null; children?: ReactNode; className?: string }

export default function ProfileCover({ src, children, className = '' }: Props) {
  return <div className={`relative h-[180px] overflow-hidden rounded-b-[20px] border-x border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] md:h-[220px] ${className}`}>
    <div aria-hidden="true" className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(circle at 18% 25%, rgba(138,90,50,.16), transparent 35%), radial-gradient(circle at 78% 65%, rgba(25,25,25,.10), transparent 40%)' }} />
    {src && <img key={src} src={src} alt="Profile cover" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none' }} />}
    {children}
  </div>
}
