import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { EXTENSION_KEY, STORE_EXTENSION_ID } from './extensionKey'

/** Chrome's rule: the first 128 bits of the SHA-256 of the DER public key, written with a-p. */
function idFromKey(base64Key: string): string {
  const hex = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex').slice(0, 32)
  return [...hex].map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('')
}

describe('extension key', () => {
  it('belongs to the store ID (so a typo in the key would fail here, not at sign-in)', () => {
    expect(idFromKey(EXTENSION_KEY)).toBe(STORE_EXTENSION_ID)
  })

  it('is a bare base64 key, with no PEM lines or whitespace', () => {
    expect(EXTENSION_KEY).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('is a valid extension ID', () => {
    expect(STORE_EXTENSION_ID).toMatch(/^[a-p]{32}$/)
  })
})
