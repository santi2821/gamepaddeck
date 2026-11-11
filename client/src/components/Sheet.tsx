import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { FOCUS_RING } from '../lib/ui'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute('aria-hidden') !== 'true' &&
      !element.hasAttribute('hidden') &&
      (typeof element.checkVisibility !== 'function' || element.checkVisibility()),
  )
}

export interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}

/** RomDeck sheet: a floating, fully rounded surface. Bottom sheet on phones,
 *  centred dialog from md up, with Escape, focus trap, scroll lock and return. */
export default function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-xl',
}: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = `${useId()}-title`
  const touchStartY = useRef<number | null>(null)
  const [present, setPresent] = useState(open)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Keep the node mounted through its exit animation, without role or focus.
  useEffect(() => {
    if (open) {
      setPresent(true)
      return
    }
    if (!present) return
    const timer = window.setTimeout(() => setPresent(false), 240)
    return () => window.clearTimeout(timer)
  }, [open, present])

  useEffect(() => {
    if (!open) return

    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current

    // Focus the dialog itself so the first visible control is not ringed by a
    // programmatic focus; Tab then enters the focus trap normally.
    dialog?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusableElements = getFocusableElements(dialog)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (!dialog.contains(activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? lastFocusable : firstFocusable).focus()
      } else if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousOverflow
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [open])

  if (!open && !present) return null
  const exiting = present && !open

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current()
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartY.current == null) return
    const deltaY = (event.changedTouches[0]?.clientY ?? 0) - touchStartY.current
    if (deltaY > 50) onCloseRef.current()
    touchStartY.current = null
  }

  return createPortal(
    <div
      data-testid="sheet-backdrop"
      className={`mochy-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center md:items-center ${
        exiting ? 'pointer-events-none opacity-0 transition-opacity duration-200' : ''
      }`}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role={exiting ? undefined : 'dialog'}
        aria-modal={exiting ? undefined : true}
        aria-hidden={exiting ? true : undefined}
        inert={exiting ? true : undefined}
        aria-labelledby={titleId}
        tabIndex={exiting ? undefined : -1}
        className={`mochy-sheet ${footer ? 'mochy-sheet--with-footer' : ''} w-full ${maxWidth} overflow-y-auto rounded-b-none outline-none md:rounded-[28px]`}
      >
        <div
          className="mochy-sheet-handle-zone -mt-1 flex cursor-grab touch-none items-center justify-center py-2 active:cursor-grabbing md:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className="mochy-sheet-handle h-1.5 w-10 rounded-full" />
        </div>
        <div className="mochy-sheet-header flex items-start justify-between">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label="cerrar"
            onClick={() => onCloseRef.current()}
            className={`mochy-sheet-close ${FOCUS_RING}`}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="mochy-sheet-content">{children}</div>
        {footer && <div className="mochy-sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
