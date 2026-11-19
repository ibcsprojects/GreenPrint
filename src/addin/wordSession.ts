// One scan-and-fix session for the document open in Word.

import { OoxmlDoc, readStyleInfo, type XmlImpl } from '../lib/ooxml/ooxml'
import { analyzeDoc } from '../lib/analyzer/rules'
import { estimatePages } from '../lib/pageEstimate'
import type { Flag } from '../lib/analyzer/types'
import { parseFlatOpc } from './flatOpc'
import { alignParagraphs, planAction } from './plan'
import { paragraphText } from '../lib/docModel'
import { readWord, runOps, selectByText, selectParagraph, StaleDocument } from './wordRun'
import type { Op } from './plan'

const impl = (): XmlImpl => ({ DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer }) as unknown as XmlImpl

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    work.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    )
  })
}

export class WordSession {
  flags: Flag[] = []
  pages = 0
  /** Set when edits are switched off for this document, with the reason. */
  blocked: string | null = null
  /** Fixes were applied since the last full scan, so the page estimate is out of date. */
  dirty = false
  /** A line about how long the last scan took, shown once under the summary. */
  note = ''
  private doc!: OoxmlDoc
  private map: (number | null)[] = []

  async scan(): Promise<void> {
    const t0 = Date.now()
    // Word can take a long time on a big document, or stall; never leave the pane spinning.
    const { xml, paras } = await withTimeout(
      readWord(),
      180_000,
      'Word took more than 3 minutes to hand over the document. Close the pane, check the document is not in Protected View or showing a dialog, then open SparePage again.',
    )
    const t1 = Date.now()
    const pkg = parseFlatOpc(xml, impl())
    const styles = pkg.stylesXml ? readStyleInfo(pkg.stylesXml, impl()) : undefined
    this.doc = new OoxmlDoc(pkg.documentXml, impl(), { title: 'Document', styles })
    const aligned = alignParagraphs(this.doc.model, this.doc.topLevel(), paras)
    this.map = aligned.ok ? aligned.wordIndex : []
    this.blocked = aligned.ok ? null : aligned.reason
    this.flags = analyzeDoc(this.doc.model)
    this.pages = estimatePages(this.doc.model).pages
    this.dirty = false
    const secs = (ms: number) => (ms < 1000 ? '<1' : String(Math.round(ms / 1000)))
    const t2 = Date.now()
    this.note = `Scanned in ${secs(t2 - t0)}s: Word handed over the document in ${secs(t1 - t0)}s, analysis took ${secs(t2 - t1)}s.`
  }

  /** Why this fix can't be applied from the add-in, or null when it can. */
  unsupported(flag: Flag): string | null {
    if (this.blocked) return `Editing is off for this document. ${this.blocked}`
    const plan = planAction(flag.action, this.doc.model, this.map)
    return plan.ok ? null : plan.reason
  }

  get applicableCount(): number {
    return this.flags.filter((f) => !f.reviewFirst && this.unsupported(f) === null).length
  }

  /**
   * Apply one fix by hand, without re-reading the whole document: the card is dropped and the
   * paragraph positions are adjusted. A paragraph that no longer matches is caught before any
   * edit, and then a full scan puts everything right.
   */
  async apply(flag: Flag): Promise<void> {
    const why = this.unsupported(flag)
    if (why) throw new Error(why)
    const plan = planAction(flag.action, this.doc.model, this.map)
    if (!plan.ok || plan.ops.length === 0) {
      throw new Error('There was nothing to change there. Choose Scan again, then try once more.')
    }
    try {
      await runOps(plan.ops)
    } catch (err) {
      if (err instanceof StaleDocument) await this.scan()
      throw err
    }
    this.afterEdit(plan.ops, [flag])
  }

  /** Drop the fixed cards and move the paragraph positions up past any deleted paragraphs. */
  private afterEdit(ops: Op[], done: Flag[]): void {
    const deleted = new Set(ops.filter((o) => o.op === 'deleteParagraph').map((o) => o.at))
    if (deleted.size > 0) {
      this.map = this.map.map((w) => {
        if (w == null || deleted.has(w)) return null
        let before = 0
        for (const d of deleted) if (d < w) before++
        return w - before
      })
    }
    const gone = new Set(done)
    this.flags = this.flags.filter((f) => !gone.has(f))
    this.dirty = true
  }

  /**
   * Apply every fix that can be done exactly, in one pass: all the steps are worked out against
   * the same scan and sent to Word together, then the document is scanned once at the end.
   */
  async applyAll(): Promise<number> {
    if (this.blocked) return 0
    const ops: Op[] = []
    const done: Flag[] = []
    for (const flag of this.flags) {
      if (flag.reviewFirst || flag.manualReason) continue
      const plan = planAction(flag.action, this.doc.model, this.map)
      if (!plan.ok || plan.ops.length === 0) continue
      ops.push(...plan.ops)
      done.push(flag)
    }
    // A paragraph that is being deleted can't also be formatted or counted twice.
    const deleted = new Set(ops.filter((o) => o.op === 'deleteParagraph').map((o) => o.at))
    const seen = new Set<number>()
    const merged = ops.filter((o) => {
      if (o.op === 'deleteParagraph') {
        if (seen.has(o.at)) return false
        seen.add(o.at)
        return true
      }
      return !deleted.has(o.at)
    })
    if (merged.length === 0) return 0
    try {
      await runOps(merged)
    } catch (err) {
      await this.scan()
      throw err
    }
    await this.scan()
    return done.length
  }

  /** Jump to an issue. Uses the matched paragraph when there is one, else finds it by its words. */
  async show(flag: Flag): Promise<void> {
    const m = this.doc.model
    const k = m.paragraphs.findIndex((p) => p.start! <= flag.range.start && flag.range.start <= p.end!)
    const at = k >= 0 ? this.map[k] : undefined
    if (at != null) {
      await selectParagraph(at)
      return
    }
    const words = k >= 0 ? paragraphText(m.paragraphs[k]) : ''
    if (!(await selectByText(words))) {
      throw new Error("Couldn't find that spot in the document. It may be inside a table or an object. Look for it by hand.")
    }
  }
}
