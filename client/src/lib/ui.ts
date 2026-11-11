/**
 * RomDeck primitives (ported from romdeck/apps/web/src/lib/ui.ts).
 * Every surface composes these instead of re-declaring control classes.
 */

export const TEXT_PRIMARY = 'text-ink-1'

export const TEXT_BODY = 'text-ink-2'

export const TEXT_SECONDARY = 'text-ink-3'

export const TEXT_TERTIARY = 'text-ink-4'

export const PLACEHOLDER = 'placeholder:text-ink-4'

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

export const TOUCH_TARGET = 'min-h-11 md:min-h-10'

export const MONO = 'font-mono text-xs tabular'

export const CONTROL = `h-10 rounded-xl border border-transparent bg-surface-2 px-4 text-sm ${TEXT_BODY} transition-colors hover:bg-surface-3 ${FOCUS_RING} disabled:opacity-50`

export const INPUT = `${CONTROL} ${PLACEHOLDER} bg-panel border border-line text-ink-1`

export const SELECT = `${CONTROL} cursor-pointer`

const BTN_LAYOUT = 'inline-flex items-center justify-center'

export const ACTION = `h-10 rounded-full ${TOUCH_TARGET} ${BTN_LAYOUT} gap-2 px-4 text-sm font-medium transition-colors ${FOCUS_RING} disabled:opacity-50`

export const BTN = `${ACTION} border border-transparent bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink-1`

export const BTN_PRIMARY = `${ACTION} bg-accent-solid px-5 font-semibold text-canvas hover:bg-accent-solid-hover`

export const BTN_GHOST = `${ACTION} text-ink-3 hover:bg-surface-2 hover:text-ink-1`

/** Neutral action for raised sections, where `BTN` would blend into surface-2. */
export const BTN_SOFT = `${ACTION} bg-surface-3 text-ink-2 hover:bg-line-strong/40 hover:text-ink-1`

export const BTN_DANGER = `${ACTION} border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20`

/** Icon-only action. No padding classes: combining them with BTN collapsed the
 *  SVG to the few pixels left after px-4. */
export const BTN_ICON = `h-10 w-10 min-h-11 min-w-11 shrink-0 rounded-full border border-transparent bg-surface-2 text-sm text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1 ${BTN_LAYOUT} ${FOCUS_RING} disabled:opacity-50 md:min-h-10 md:min-w-10`

export const PANEL = 'rounded-2xl bg-panel'

export const PANEL_RAISED = 'rounded-xl border border-line bg-surface-2'

export const ROW =
  'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-2 px-3.5 py-2 text-sm'

export const CHIP = 'inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2'

export const PAGE_TITLE = 'font-display text-3xl font-semibold tracking-tight text-ink-1 md:text-4xl'

export const SECTION_TITLE = 'font-display text-[15px] font-semibold tracking-tight text-ink-1'

export const FIELD_LABEL = 'text-xs font-medium text-ink-3'

export function pill(active: boolean): string {
  return `h-10 ${TOUCH_TARGET} ${BTN_LAYOUT} whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${FOCUS_RING} disabled:opacity-50 ${
    active
      ? 'bg-ink-1 text-canvas font-semibold shadow-sm'
      : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink-1'
  }`
}

/** Small pill used by compact filter rows and in-sheet slot pickers. */
export function pillSmall(active: boolean): string {
  return `h-9 min-h-11 md:min-h-9 ${BTN_LAYOUT} whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors ${FOCUS_RING} disabled:opacity-50 ${
    active
      ? 'bg-ink-1 text-canvas font-semibold shadow-sm'
      : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink-1'
  }`
}
