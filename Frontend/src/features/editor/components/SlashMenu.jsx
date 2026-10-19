import ViewportPopover from '@/shared/components/ui/ViewportPopover'
/* eslint-disable react-hooks/set-state-in-effect -- A filter change intentionally restores the roving option to the first item. */
import { useState, useEffect, useRef } from 'react'

export default function SlashMenu({
  options = [],
  anchorRef,
  onSelect,
  onClose,
  filter = '',
}) {
  const [selected, setSelected] = useState(0)
  const menuRef = useRef()
  const itemRefs = useRef([])

  // Filter options
  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(filter.toLowerCase()) ||
      opt.type.toLowerCase().includes(filter.toLowerCase())
  )

  // Parent renders (including autosave) recreate the array without changing choices.
  const optionTypes = options.map(option => option.type).join(',')
  useEffect(() => {
    setSelected(0)
  }, [filter, optionTypes])

  useEffect(() => {
    function handleKey(e) {
      if (e.isComposing || (!anchorRef.current?.contains(e.target) && !menuRef.current?.contains(e.target))) return
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return
      if (e.key === 'Tab' && !filtered[selected]) {
        onClose()
        return
      }
      // Own these keys before the editor can move focus to a different block.
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'ArrowDown') {
        if (filtered.length) setSelected((s) => (s + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        if (filtered.length) setSelected((s) => (s - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selected]) {
          onSelect(filtered[selected])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKey, true)
    
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [anchorRef, filtered, selected, onSelect, onClose])

  // Auto scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selected]

    const menu = menuRef.current
    if (selectedItem && menu) {
      // Scroll only this panel, immediately; scrollIntoView also moves ancestors.
      const top = selectedItem.offsetTop
      const bottom = top + selectedItem.offsetHeight
      if (top < menu.scrollTop) menu.scrollTop = top
      else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight
    }
  }, [selected, filter, optionTypes])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClick)
    
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!filtered.length) return null

  return (
    <ViewportPopover anchorRef={anchorRef} align="start" onAnchorHidden={onClose}
      ref={menuRef}
      id="editor-slash-menu"
      role="listbox"
      aria-label="Insert block"
      style={{
        minWidth: 220,
        maxHeight: 200,
        height: 'auto',
        overflowY: 'auto',
        scrollBehavior: 'auto',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: 8,
      }}
    >
      {filtered.map((opt, i) => (
        <button
          key={opt.type}
          type="button"
          role="option"
          aria-selected={i === selected}
          aria-label={`Insert ${opt.label}`}
          onClick={() => onSelect(opt)}
          ref={(el) => itemRefs.current[i] = el}
          tabIndex={i === selected ? 0 : -1}
          style={{
            width: '100%',
            border: 0,
            textAlign: 'left',
            padding: '8px 12px',
            minHeight: 44,
            borderRadius: 6,
            background: i === selected ? 'var(--color-bg-alt)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 500,
            color: 'var(--color-text)',
          }}
        >
          <span style={{ width: 28, display: 'inline-block', textAlign: 'center' }}>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </ViewportPopover>
  )
}
