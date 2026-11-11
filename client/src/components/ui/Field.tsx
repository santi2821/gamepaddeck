import type { InputHTMLAttributes, ReactNode } from 'react'
import { INPUT, TEXT_BODY, TEXT_TERTIARY } from '../../lib/ui'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  hint?: ReactNode
  error?: ReactNode
  className?: string
}

function hasContent(value: ReactNode): boolean {
  if (value == null || value === false) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/** RomDeck Field: label, input, hint and error with a shared description wiring. */
export default function Field({
  id,
  label,
  hint,
  error,
  className = '',
  'aria-describedby': providedDescription,
  'aria-invalid': providedInvalid,
  ...inputProps
}: FieldProps) {
  const hasHint = hasContent(hint)
  const hasError = hasContent(error)
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const trimmedProvided =
    typeof providedDescription === 'string' ? providedDescription.trim() : providedDescription
  const describedBy =
    [trimmedProvided, hasHint ? hintId : '', hasError ? errorId : ''].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={`block text-xs font-medium ${TEXT_BODY}`}>
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        className={`${INPUT} w-full ${hasError ? 'border-danger/50' : ''} ${className}`}
        aria-describedby={describedBy}
        aria-invalid={hasError ? true : providedInvalid}
      />
      {hasHint && (
        <p id={hintId} className={`text-xs leading-relaxed ${TEXT_TERTIARY}`}>
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
