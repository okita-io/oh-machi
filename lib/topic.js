import crypto from 'node:crypto'

/** @param {string} townName */
export function normalizeTownName(townName) {
  return townName.trim().toLowerCase().replace(/\s+/g, '-')
}

/** 32-byte Hyperswarm topic from design doc public neighborhood key. */
export function townTopicKey(townName) {
  const normalized = normalizeTownName(townName)
  return crypto.createHash('sha256').update(`ohmachi/neighborhood/v1/${normalized}`).digest()
}

/** Short id for mDNS instance name (non-secret fingerprint). */
export function townFingerprint(topicKey) {
  return topicKey.subarray(0, 8).toString('hex')
}