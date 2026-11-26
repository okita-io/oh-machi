import fs from 'node:fs/promises'
import path from 'node:path'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { configDir } from './config.js'

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

const ID_FILE = 'identity.json'

function toHex(bytes) {
  return Buffer.from(bytes).toString('hex')
}

function fromHex(hex) {
  return Buffer.from(hex, 'hex')
}

/**
 * @typedef {{ publicKey: Uint8Array, secretKey: Uint8Array, publicKeyHex: string }} Identity
 */

/** @param {string} [dir] */
export async function loadOrCreateIdentity(dir = configDir()) {
  const file = path.join(dir, ID_FILE)
  await fs.mkdir(dir, { recursive: true })
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'))
    const publicKey = fromHex(raw.publicKey)
    const secretKey = fromHex(raw.secretKey)
    return { publicKey, secretKey, publicKeyHex: toHex(publicKey) }
  } catch {
    const secretKey = ed.utils.randomPrivateKey()
    const publicKey = await ed.getPublicKeyAsync(secretKey)
    const record = {
      version: 1,
      algorithm: 'Ed25519',
      publicKey: toHex(publicKey),
      secretKey: toHex(secretKey),
      createdAt: new Date().toISOString(),
    }
    await fs.writeFile(file, JSON.stringify(record, null, 2), { mode: 0o600 })
    return { publicKey, secretKey, publicKeyHex: toHex(publicKey) }
  }
}

/**
 * @param {Identity} identity
 * @param {string} messageUtf8
 */
export async function signMessage(identity, messageUtf8) {
  const sig = await ed.signAsync(Buffer.from(messageUtf8, 'utf8'), identity.secretKey)
  return toHex(sig)
}

/**
 * @param {string} publicKeyHex
 * @param {string} messageUtf8
 * @param {string} signatureHex
 */
export function verifyMessage(publicKeyHex, messageUtf8, signatureHex) {
  try {
    return ed.verify(fromHex(signatureHex), Buffer.from(messageUtf8, 'utf8'), fromHex(publicKeyHex))
  } catch {
    return false
  }
}