import type { ReactNode } from 'react'
import { PANEL, TEXT_TERTIARY } from '../../lib/ui'

export interface SectionProps {
  title: string
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Inside a sheet the surrounding surface is already `panel`; a raised
   *  section keeps the hierarchy visible. */
  raised?: boolean
}

/** RomDeck settings/detail section: a panel with its own heading hierarchy. */
export default function Section({
  title,
  description,
  meta,
  actions,
  children,
  className = '',
  raised = false,
}: SectionProps) {
  return (
    <section
      className={`${raised ? 'rounded-2xl bg-surface-2' : PANEL} min-w-0 p-5 md:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-1">
            {title}
          </h2>
          {description && (
            <p className={`max-w-prose text-xs leading-relaxed ${TEXT_TERTIARY}`}>
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta}
          {actions}
        </div>
      </div>
      {children}
    </section>
  )
}
