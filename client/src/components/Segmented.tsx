import type { KeyboardEvent, ReactNode } from 'react'
import { useId, useRef } from 'react'
import { TEXT_BODY } from '../lib/ui'

export interface SegmentedOption<T extends string | number = string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string | number = string> {
  label?: string
  options: SegmentedOption<T>[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  hideLabel?: boolean
  size?: 'sm' | 'md'
}

export default function Segmented<T extends string | number = string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  hideLabel = true,
  size = 'md',
}: SegmentedProps<T>) {
  const labelId = useId()
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
  const firstEnabledIndex = options.findIndex((option) => !option.disabled)

  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled) return
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    const enabledIndexes = options.flatMap((option, optionIndex) =>
      option.disabled ? [] : [optionIndex],
    )
    if (direction === 0 && event.key !== 'Home' && event.key !== 'End') return
    const currentPosition = enabledIndexes.indexOf(index)
    if (currentPosition < 0) return
    const nextPosition =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabledIndexes.length - 1
          : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length
    const nextIndex = enabledIndexes[nextPosition]
    if (nextIndex == null) return
    event.preventDefault()
    onChange(options[nextIndex].value)
    optionRefs.current[nextIndex]?.focus()
  }

  const isSmall = size === 'sm'

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <span id={labelId} className={hideLabel ? 'sr-only' : `block text-xs ${TEXT_BODY}`}>
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? labelId : undefined}
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-line bg-surface-2 p-1"
      >
        {options.map((option, index) => {
          const selected = option.value === value
          const tabIndex =
            selectedIndex >= 0 ? (selected ? 0 : -1) : index === firstEnabledIndex ? 0 : -1
          const optionDisabled = disabled || option.disabled
          return (
            <button
              key={String(option.value)}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={optionDisabled || undefined}
              disabled={optionDisabled}
              tabIndex={tabIndex}
              className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
                isSmall ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-xs'
              } ${
                selected
                  ? 'bg-ink-1 text-canvas font-semibold shadow-sm'
                  : 'text-ink-3 hover:bg-surface-3 hover:text-ink-1'
              }`}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => moveSelection(event, index)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
