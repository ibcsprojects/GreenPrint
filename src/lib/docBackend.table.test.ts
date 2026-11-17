import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rebuildOffsets, type DocModel } from './docModel'
import type { ApiDoc } from './googleDocs'

// Capture the batchUpdate requests the live backend emits, and feed back a fake
// "table inserted" document on read so the two-pass cell fill can be exercised
// without touching the network.
const pushed: unknown[][] = []

vi.mock('./googleDocs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./googleDocs')>()
  return {
    ...actual, // keep the real tableCellStarts so its parsing is under test too
    pushBatchUpdate: vi.fn(async (_id: string, requests: unknown[]) => {
      pushed.push(requests)
    }),
    fetchGoogleDocRaw: vi.fn(async (): Promise<ApiDoc> => RAW_AFTER_INSERT),
    fetchGoogleDoc: vi.fn(async (): Promise<DocModel> => ({
      id: 'd',
      title: 't',
      defaultFontSize: 11,
      linesPerPage: 46,
      paragraphs: [],
    })),
  }
})

import { GoogleDocsBackend } from './docBackend'

// A heading, six short bullets, then a closing paragraph, with Docs index anchors.
const liveDoc = (): DocModel => {
  let idx = 1
  const para = (text: string, kind: 'heading' | 'bullet' | 'normal') => {
    const docStart = idx
    const docEnd = idx + text.length + 1 // + trailing newline
    idx = docEnd
    return { id: text.slice(0, 4), kind, runs: [{ text, fontSize: 11, docStart }], docStart, docEnd }
  }
  return rebuildOffsets({
    id: 'd',
    title: 't',
    defaultFontSize: 11,
    linesPerPage: 46,
    paragraphs: [
      para('Observations:', 'heading'),
      para('Remote work is here to stay.', 'bullet'),
      para('Supply chains remain fragile.', 'bullet'),
      para('Inflation persists globally.', 'bullet'),
      para('Renewable energy is expanding.', 'bullet'),
      para('Cybersecurity threats are escalating.', 'bullet'),
      para('Consumer spending is volatile.', 'bullet'),
      para('Next steps.', 'normal'),
    ],
  })
}

// What the doc looks like when we re-read it after insertTable: a 2×4 empty table
// sitting where the bullets were, then the stray empty line insertTable leaves below it. Cell paragraph start indices are arbitrary but
// increasing in row-major order, as the real API returns them.
const cell = (startIndex: number) => ({
  content: [{ startIndex, paragraph: { elements: [] } }],
})
const RAW_AFTER_INSERT: ApiDoc = {
  body: {
    content: [
      { startIndex: 1, paragraph: { elements: [{ textRun: { content: 'Observations:\n' } }] } },
      {
        startIndex: 15,
        table: {
          tableRows: [
            { tableCells: [cell(18), cell(22), cell(26), cell(30)] },
            { tableCells: [cell(40), cell(44), cell(48), cell(52)] },
          ],
        },
      },
      { startIndex: 60, endIndex: 61, paragraph: { elements: [{ textRun: { content: '\n' } }] } },
      { startIndex: 61, endIndex: 73, paragraph: { elements: [{ textRun: { content: 'Next steps.\n' } }] } },
    ],
  },
}

describe('GoogleDocsBackend.applyBulletsToTable (live path)', () => {
  beforeEach(() => (pushed.length = 0))

  it('emits a correct delete + insertTable setup, then fills cells in descending order', async () => {
    const doc = liveDoc()
    const rows = doc.paragraphs.filter((p) => p.kind === 'bullet').map((p) => p.runs[0].text)
    const bullets = doc.paragraphs.filter((p) => p.kind === 'bullet')
    const range = { start: bullets[0].start!, end: bullets[bullets.length - 1].end! }

    await new GoogleDocsBackend('d').apply(doc, { kind: 'bulletsToTable', range, rows })

    // Two batches: the structural setup, then the cell fill.
    expect(pushed).toHaveLength(2)
    const [setup, fill] = pushed as [any[], any[]]

    const startIndex = bullets[0].docStart! // 15
    const lastEnd = bullets[bullets.length - 1].docEnd!
    expect(setup[0]).toEqual({ deleteParagraphBullets: { range: { startIndex, endIndex: lastEnd - 1 } } })
    // The bullets go entirely (newlines included), so no empty line is left where they were...
    expect(setup[1]).toEqual({ deleteContentRange: { range: { startIndex, endIndex: lastEnd } } })
    expect(setup[2].insertTable.rows).toBe(2)
    expect(setup[2].insertTable.columns).toBe(4)
    // ...and the table hangs off the end of the heading, so insertTable's own newline just
    // ends the heading instead of adding a blank line above the table.
    expect(setup[2].insertTable.location).toEqual({ index: startIndex - 1 })

    // The empty line that lands below the table is deleted first (it's past every cell).
    expect(fill[0]).toEqual({ deleteContentRange: { range: { startIndex: 60, endIndex: 61 } } })

    // Fill: one insertText per non-empty cell, highest index first so earlier
    // insertions don't shift the indices still to be written.
    const cells = fill.slice(1)
    const indices = cells.map((r) => r.insertText.location.index)
    expect([...indices].sort((a, b) => b - a)).toEqual(indices)

    // Row-major cell text lands in the matching cell.
    const byIndex = Object.fromEntries(
      cells.map((r) => [r.insertText.location.index, r.insertText.text]),
    )
    expect(byIndex[18]).toBe('Remote work is here to stay.')
    expect(byIndex[22]).toBe('Supply chains remain fragile.')
    expect(byIndex[52]).toBeUndefined() // padding cell, never written
  })
})
