// A self-contained print-intercept modal rendered into a Shadow DOM so Google Docs'
// styles can't touch it and ours can't leak out. Vanilla DOM (no React) to keep the
// content-script bundle tiny. Styled to match the overlay panel: same surface, header,
// type sizes and buttons.

import type { Settings } from '../lib/messaging'
import { logoUrl } from '../overlay/logo'

export interface PrintSummary {
  pages: number
  /** True when `pages` came from Docs' own PDF export; false when it's our estimate. */
  pagesExact: boolean
  unresolved: { type: string; title: string }[]
  settings: Settings
}

// Values are the overlay's Tailwind tokens (leaf, bark, paper, shadow-panel).
const STYLE = `
:host { all: initial; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483647;
  background: rgba(31, 36, 23, 0.32);
  display: grid; place-items: center; padding: 16px;
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased; color: #1f2417;
}
.modal {
  width: 360px; max-width: 100%; overflow: hidden;
  background: #fafbf8; border: 1px solid #dcfce7; border-radius: 16px;
  box-shadow: 0 18px 48px rgba(31, 36, 23, 0.18), 0 2px 6px rgba(31, 36, 23, 0.08);
}
.head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 6px 6px 12px; background: #fff; border-bottom: 1px solid #dcfce7;
}
.head img { width: 20px; height: 20px; }
.head .name { flex: 1; font-size: 13px; font-weight: 600; }
.close {
  display: grid; place-items: center; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 8px; background: none; color: rgba(63, 63, 41, 0.8); cursor: pointer;
}
.close:hover { background: #f0fdf4; color: #166534; }
.body { padding: 14px 16px 4px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; }
.lede b { font-weight: 600; color: #1f2417; }
.lede { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: rgba(63, 63, 41, 0.8); }
.note { margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: rgba(63, 63, 41, 0.8); }
.foot { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 12px; }
button { font: inherit; cursor: pointer; }
.primary {
  border: 0; border-radius: 12px; padding: 9px 12px;
  background: #15803d; color: #fff; font-size: 13px; font-weight: 600;
}
.primary:hover { background: #166534; }
.quiet {
  border: 0; border-radius: 8px; padding: 6px 12px; background: none;
  color: rgba(63, 63, 41, 0.8); font-size: 12px; font-weight: 500;
}
.quiet:hover { background: #f0fdf4; color: #166534; }
button:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
`

export type PrintModalResult = 'print' | 'review' | 'cancel'

export function showPrintModal(summary: PrintSummary): Promise<PrintModalResult> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.id = 'sparepage-print-modal'
    document.documentElement.appendChild(host)
    const root = host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = STYLE
    root.appendChild(style)

    const issues = summary.unresolved.length
    const s = (n: number) => (n === 1 ? '' : 's')
    const length = `${summary.pagesExact ? '' : 'about '}${summary.pages} page${s(summary.pages)}`
    const lede = issues
      ? `This document is ${length} and has <b>${issues} issue${s(issues)}</b> that waste${issues === 1 ? 's' : ''} paper or ink.`
      : `This document is ${length} and ready to print.`
    const note = summary.settings.duplexReminder ? 'Tip: printing double-sided uses half the paper.' : ''

    const wrap = document.createElement('div')
    wrap.className = 'backdrop'
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sp-title">
        <div class="head">
          <img src="${logoUrl()}" alt="" />
          <span class="name">SparePage</span>
          <button class="close" data-act="cancel" aria-label="Keep editing" title="Keep editing">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="body">
          <h2 id="sp-title">Before you print</h2>
          <p class="lede">${lede}</p>
          ${note ? `<p class="note">${note}</p>` : ''}
        </div>
        <div class="foot">
          ${
            issues
              ? `<button class="primary" data-act="review">Review ${issues} fix${issues === 1 ? '' : 'es'}</button>
                 <button class="quiet" data-act="print">Print anyway</button>`
              : `<button class="primary" data-act="print">Print</button>`
          }
        </div>
      </div>`
    root.appendChild(wrap)

    const done = (r: PrintModalResult) => {
      document.removeEventListener('keydown', onKey, true)
      host.remove()
      resolve(r)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        done('cancel')
      }
    }
    document.addEventListener('keydown', onKey, true)
    wrap.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => done(b.dataset.act as PrintModalResult)),
    )
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) done('cancel')
    })
    wrap.querySelector<HTMLButtonElement>('.primary')?.focus()
  })
}
