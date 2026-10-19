import { createPortal } from 'react-dom'
import useOverlayViewport from '@/shared/hooks/useOverlayViewport'

export default function MobileEditorCommands({ options, activeType, onSelect }) {
  const viewport = useOverlayViewport()
  const viewportBottom = Number(viewport.top) + Number(viewport.height)
  const navigation = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
  const navigationOverlap = navigation && navigation.top < viewportBottom && navigation.bottom >= viewportBottom
    ? viewportBottom - navigation.top : 0

  return createPortal(
    <div data-mobile-editor-commands role="toolbar" aria-label="Block types"
      className="fixed z-[200] flex h-[52px] items-center gap-1 overflow-x-auto overscroll-x-contain border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 shadow-[var(--shadow-menu)] touch-pan-x md:hidden"
      style={{ left: viewport.left, width: viewport.width, top: viewportBottom - navigationOverlap - 52 }}>
      {options.map(option => <button key={option.type} type="button" aria-label={option.label}
        aria-pressed={activeType === option.type}
        onPointerDown={event => event.preventDefault()}
        onClick={() => onSelect(option)}
        className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] ${activeType === option.type ? 'bg-[var(--color-bg-alt)]' : ''}`}>
        <span aria-hidden="true">{option.icon}</span><span>{option.label}</span>
      </button>)}
    </div>, document.body
  )
}
