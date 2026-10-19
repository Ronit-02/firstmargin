/* Pill — filter/tab toggle button */
import { getButtonClasses } from './buttonStyles'

export default function Pill({ label, active = false, size = 'md', onClick, role, ariaControls, onKeyDown, tabIndex, id }) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      aria-pressed={role === 'tab' ? undefined : active}
      aria-selected={role === 'tab' ? active : undefined}
      aria-controls={ariaControls}
      tabIndex={tabIndex}
      data-button-size={size}
      data-button-variant={active ? 'primary' : 'selector'}
      className={getButtonClasses({ variant: active ? 'primary' : 'selector', size, className: onClick ? 'cursor-pointer' : '!cursor-default' })}
    >
      {label}
    </button>
  )
}
