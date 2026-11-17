import type { FlagType } from '../../lib/analyzer/types'

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

/** One dot colour per kind of issue, so each kind is recognisable at a glance in the list
 *  (the way LanguageTool colours spelling, grammar and style differently). */
export const TYPE_DOT: Record<FlagType, { name: string; dot: string }> = {
  highlight: { name: 'Highlight', dot: 'bg-amber-400' },
  fontSize: { name: 'Font size', dot: 'bg-sky-500' },
  doubleSpacing: { name: 'Empty lines', dot: 'bg-violet-500' },
  blankPage: { name: 'Blank page', dot: 'bg-rose-500' },
  pageBreak: { name: 'Page break', dot: 'bg-pink-400' },
  bulletSprawl: { name: 'Bullet list', dot: 'bg-teal-500' },
  verbose: { name: 'Wordy text', dot: 'bg-leaf-600' },
  largeImage: { name: 'Large image', dot: 'bg-indigo-500' },
  wideMargins: { name: 'Margins', dot: 'bg-orange-500' },
  wideIndents: { name: 'Indents', dot: 'bg-lime-500' },
}
