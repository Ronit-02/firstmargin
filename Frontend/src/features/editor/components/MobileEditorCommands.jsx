import { createPortal } from 'react-dom'
import useOverlayViewport from '@/shared/hooks/useOverlayViewport'

export default function MobileEditorCommands({ options, activeType, onSelect, onUndo, onRedo, canUndo, canRedo, canFormat, hasSelection, onFormat }) {
  const viewport = useOverlayViewport()
  const viewportBottom = Number(viewport.top) + Number(viewport.height)
  const navigation = document.querySelector('[aria-label="Mobile primary navigation"]')?.getBoundingClientRect()
  const navigationOverlap = navigation && navigation.top < viewportBottom && navigation.bottom >= viewportBottom
    ? viewportBottom - navigation.top : 0

  return createPortal(
    <div data-mobile-editor-commands role="toolbar" aria-label="Editor commands"
      className="fixed z-[200] flex h-[52px] items-center gap-1 overflow-x-auto overscroll-x-contain border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 shadow-[var(--shadow-menu)] touch-pan-x md:hidden"
      style={{ left: viewport.left, width: viewport.width, top: viewportBottom - navigationOverlap - 52 }}>
      <button type="button" aria-label="Undo writing change" title="Undo" disabled={!canUndo}
        onPointerDown={event => event.preventDefault()} onClick={onUndo}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 14-5-5 5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></svg>
      </button>
      <button type="button" aria-label="Redo writing change" title="Redo" disabled={!canRedo}
        onPointerDown={event => event.preventDefault()} onClick={onRedo}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h2" /></svg>
      </button>
      <button type="button" aria-label="Bold selected text" title="Bold" disabled={!canFormat || !hasSelection}
        onPointerDown={event => event.preventDefault()} onClick={() => onFormat('**')}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 text-[16px] font-bold text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed">B</button>
      <button type="button" aria-label="Italicize selected text" title="Italic" disabled={!canFormat || !hasSelection}
        onPointerDown={event => event.preventDefault()} onClick={() => onFormat('*')}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 text-[18px] font-semibold italic text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed">i</button>
      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-[var(--color-border)]" />
      {options.map(option => <button key={option.type} type="button" aria-label={option.label}
        aria-pressed={activeType === option.type}
        onPointerDown={event => event.preventDefault()}
        onClick={() => onSelect(option)}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 text-[16px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] ${activeType === option.type ? 'bg-[var(--color-bg-alt)]' : ''}`}>
        <span aria-hidden="true">{option.type === 'image'
          ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          : option.type === 'text' ? 'P' : option.icon}</span>
      </button>)}
    </div>, document.body
  )
}
