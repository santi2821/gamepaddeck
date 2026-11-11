import type { ReactNode } from 'react'
import { TEXT_BODY, TEXT_TERTIARY } from '../../lib/ui'

export interface SwitchRowProps {
  id: string
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** RomDeck preference row: native checkbox with role="switch", label and hint.
 *  The visual switch comes from `input[role='switch']` in deck-system.css. */
export default function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: SwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <label htmlFor={id} className={`block text-[13px] font-medium ${TEXT_BODY}`}>
          {label}
        </label>
        {description && (
          <p className={`text-xs leading-relaxed ${TEXT_TERTIARY}`}>{description}</p>
        )}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  )
}
