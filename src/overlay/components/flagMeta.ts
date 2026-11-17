import type { FlagType, Severity } from '../../lib/analyzer/types'

const PAPER = { label: 'Paper', accent: 'bg-sky-100 text-sky-800' }
const INK = { label: 'Ink', accent: 'bg-amber-100 text-amber-800' }

export const FLAG_META: Record<FlagType, { label: string; accent: string }> = {
  highlight: INK,
  fontSize: PAPER,
  doubleSpacing: PAPER,
  blankPage: PAPER,
  pageBreak: PAPER,
  bulletSprawl: PAPER,
  verbose: PAPER,
  largeImage: PAPER,
  wideMargins: PAPER,
  wideIndents: PAPER,
}

/** Paper saved, always in pages so every number in the panel reads the same way. */
export function formatPages(p: number): string {
  return `${p < 0.1 ? '<0.1' : p.toFixed(1)} pg`
}

export const SEVERITY_DOT: Record<Severity, string> = {
  low: 'bg-leaf-400',
  medium: 'bg-amber-400',
  high: 'bg-rose-500',
}
