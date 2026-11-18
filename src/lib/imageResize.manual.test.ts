import { describe, it, expect } from 'vitest'
import { mapApiDoc, whyNotResizable, type ApiDoc } from './googleDocs'
import { analyzeDoc, totalImpact } from './analyzer/rules'
import { applyAllFixes } from './applyAll'
import { MockDocsBackend } from './docBackend'

// A one-paragraph doc holding one inline object, shaped like the Docs API's reply.
const docWith = (embeddedObject: Record<string, unknown>): ApiDoc =>
  ({
    inlineObjects: {
      obj1: {
        inlineObjectProperties: {
          embeddedObject: {
            size: { width: { magnitude: 468, unit: 'PT' }, height: { magnitude: 560, unit: 'PT' } },
            ...embeddedObject,
          },
        },
      },
    },
    body: {
      content: [
        {
          startIndex: 1,
          paragraph: {
            elements: [
              { startIndex: 1, endIndex: 2, inlineObjectElement: { inlineObjectId: 'obj1' } },
              { startIndex: 2, endIndex: 3, textRun: { content: '\n' } },
            ],
          },
        },
      ],
    },
  }) as ApiDoc

const imageFlag = (d: ApiDoc) => analyzeDoc(mapApiDoc('d', d)).find((f) => f.type === 'largeImage')

describe('pictures SparePage cannot re-insert are left for the user', () => {
  it('a Google Drawing is flagged by hand, not with an Apply that would fail', () => {
    const f = imageFlag(docWith({ embeddedDrawingProperties: {} }))
    expect(f).toBeDefined()
    expect(f!.manualReason).toMatch(/Google Drawing/)
  })

  it('a plain picture with a URL is still a one-click fix', () => {
    const f = imageFlag(docWith({ imageProperties: { contentUri: 'https://x.test/a.png' } }))
    expect(f).toBeDefined()
    expect(f!.manualReason).toBeUndefined()
  })

  it.each([
    ['no source URL', { imageProperties: {} }, undefined, /no source/],
    ['a linked Sheets chart', { imageProperties: {}, linkedContentReference: {} }, 'u', /linked/],
    ['a cropped picture', { imageProperties: { cropProperties: { offsetTop: 0.2 } } }, 'u', /cropped/],
    ['a rotated picture', { imageProperties: { angle: 1.57 } }, 'u', /rotated/],
  ])('%s', (_name, embedded, uri, why) => {
    expect(whyNotResizable(embedded as never, uri)).toMatch(why)
  })

  it('Apply all skips it and does not count its saving', async () => {
    const doc = mapApiDoc('d', docWith({ embeddedDrawingProperties: {} }))
    const flags = analyzeDoc(doc)
    expect(totalImpact(flags).paper).toBe(0)
    let calls = 0
    const apply = async (d: typeof doc, a: Parameters<MockDocsBackend['apply']>[1]) => {
      calls++
      return new MockDocsBackend().apply(d, a)
    }
    const res = await applyAllFixes(doc, (d) => analyzeDoc(d), apply)
    expect(calls).toBe(0)
    expect(res.applied).toBe(0)
  })
})
