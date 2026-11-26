import { signMessage, verifyMessage } from './identity.js'

/**
 * Canonical hello string for Ed25519 (pipe-delimited, stable fields).
 * @param {{ town: string, publicKeyHex: string, ts: number, nonce: string }} fields
 */
export function helloMessage(fields) {
  const town = fields.town.trim().toLowerCase().replace(/\s+/g, '-')
  return `ohmachi-hello-v1|${town}|${fields.publicKeyHex}|${fields.ts}|${fields.nonce}`
}

/**
 * @param {import('./identity.js').Identity} identity
 * @param {string} town
 */
export async function buildHello(identity, town) {
  const payload = {
    v: 1,
    type: 'hello',
    town,
    publicKey: identity.publicKeyHex,
    ts: Date.now(),
    nonce: cryptoRandomHex(16),
  }
  const canonical = helloMessage({
    town,
    publicKeyHex: identity.publicKeyHex,
    ts: payload.ts,
    nonce: payload.nonce,
  })
  const signature = await signMessage(identity, canonical)
  return { ...payload, signature, canonical }
}

/** @param {object} hello */
export function verifyHello(hello, expectedTown) {
  if (hello?.type !== 'hello' || hello.v !== 1) return false
  const canonical = helloMessage({
    town: expectedTown,
    publicKeyHex: hello.publicKey,
    ts: hello.ts,
    nonce: hello.nonce,
  })
  return verifyMessage(hello.publicKey, canonical, hello.signature)
}

function cryptoRandomHex(bytes) {
  const b = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(b)
  return Buffer.from(b).toString('hex')
}