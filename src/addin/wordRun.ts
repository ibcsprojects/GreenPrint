// The only file that calls Word's API. It reads the body as OOXML plus the paragraph list,
// and carries out the exact steps planAction produced. Everything else is plain logic.

import { norm, type Op, type WordPara } from './plan'

/** Word's paragraphs are no longer what the last scan saw, so nothing was changed. */
export class StaleDocument extends Error {
  constructor() {
    super('The document changed since the last scan, so SparePage left it alone and scanned again. Please try that once more.')
  }
}

export async function readWord(): Promise<{ xml: string; paras: WordPara[] }> {
  return Word.run(async (context) => {
    const body = context.document.body
    const ooxml = body.getOoxml()
    const paragraphs = body.paragraphs
    paragraphs.load('items/text,items/tableNestingLevel')
    await context.sync()
    return {
      xml: ooxml.value,
      paras: paragraphs.items.map((p) => ({ text: p.text, nesting: p.tableNestingLevel })),
    }
  })
}

/**
 * Scroll Word to a paragraph by putting the cursor at its start. Nothing is left highlighted: a
 * highlighted selection pulls focus into the document, and the next click on the pane is lost.
 */
export async function selectParagraph(at: number): Promise<void> {
  await Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs
    paragraphs.load('items')
    await context.sync()
    paragraphs.items[at]?.select('Start')
    await context.sync()
  })
}

/**
 * Find a paragraph by its words and select it. The fallback for when a paragraph's position
 * can't be matched safely: it only moves the selection, so it can't change the document.
 */
export async function selectByText(text: string): Promise<boolean> {
  const query = text.split(/[\r\n\v]/)[0].replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!query) return false
  return Word.run(async (context) => {
    const found = context.document.body.search(query, { matchCase: true })
    found.load('items')
    await context.sync()
    if (found.items.length === 0) return false
    found.items[0].select('Start')
    await context.sync()
    return true
  })
}

export async function runOps(ops: Op[]): Promise<void> {
  if (ops.length === 0) return
  await Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs
    paragraphs.load('items')
    await context.sync()

    // Check every target still holds the text we read, before touching anything.
    const targets = ops.filter((o) => o.expect !== undefined && paragraphs.items[o.at])
    for (const o of targets) paragraphs.items[o.at].load('text')
    if (targets.length) await context.sync()
    for (const o of targets) {
      if (norm(paragraphs.items[o.at].text) !== o.expect) throw new StaleDocument()
    }

    // Pictures need their current size before we can scale them.
    const pictureOps = ops.filter((o): o is Extract<Op, { op: 'scalePictures' }> => o.op === 'scalePictures')
    const pictures = pictureOps.map((o) => {
      const pics = paragraphs.items[o.at].inlinePictures
      pics.load('items/width,items/height')
      return pics
    })
    if (pictures.length) await context.sync()

    for (const op of ops) {
      const para = paragraphs.items[op.at]
      if (!para) continue
      switch (op.op) {
        case 'deleteParagraph':
          para.delete()
          break
        case 'setIndent':
          if (op.left) para.leftIndent = 0
          if (op.right) para.rightIndent = 0
          break
        case 'scalePictures': {
          const pics = pictures[pictureOps.indexOf(op)].items
          for (const [n, pic] of pics.entries()) {
            if (op.only != null && n !== op.only) continue
            const width = Math.round(pic.width * op.scale)
            const height = Math.round(pic.height * op.scale)
            pic.lockAspectRatio = true
            pic.width = width
            pic.height = height
          }
          break
        }
        case 'setFont':
          if (op.size != null) para.font.size = op.size
          if (op.clearHighlight) {
            para.font.highlightColor = null as unknown as string
            if (op.alt === 'underline') para.font.underline = 'Single'
            else para.font.italic = true
          }
          break
        case 'replaceText':
          para.insertText(op.text, 'Replace')
          break
      }
    }
    await context.sync()
  })
}
