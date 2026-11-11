import type { ReactNode } from 'react'

export interface PageHeadingProps {
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
}

/** RomDeck page heading: display title, muted description, actions on the right. */
export default function PageHeading({
  title,
  description,
  actions,
  children,
}: PageHeadingProps) {
  return (
    <header className="page-heading">
      <div className="page-heading-row">
        <div className="min-w-0">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="page-heading-actions">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
