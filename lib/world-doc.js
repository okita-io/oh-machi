import * as Y from 'yjs'

const MAX_CHAT = 200

/**
 * @param {Y.Doc} doc
 */
export function initWorldDoc(doc) {
  const players = doc.getMap('players')
  const chat = doc.getArray('chat')
  if (chat.length === 0) {
    // noop — empty neighborhood
  }
  return { players, chat }
}

/**
 * @param {Y.Map} players
 * @param {string} publicKeyHex
 * @param {{ x: number, y: number, z: number, facing_deg: number }} patch
 */
export function upsertLocalPlayer(players, publicKeyHex, patch) {
  const prev = players.get(publicKeyHex) || {}
  const position = { ...(prev.position || {}), ...patch.position }
  players.set(publicKeyHex, {
    ...prev,
    position: {
      x: position.x ?? 0,
      y: position.y ?? 0,
      z: position.z ?? 0,
    },
    facing_deg: patch.facing_deg ?? prev.facing_deg ?? 0,
    last_seen: Date.now(),
  })
}

/**
 * @param {Y.Array} chat
 * @param {string} authorHex
 * @param {string} text
 */
export function appendChat(chat, authorHex, text) {
  const trimmed = String(text).trim()
  if (!trimmed) return
  chat.push([
    {
      id: `${authorHex.slice(0, 8)}-${Date.now()}`,
      author: authorHex,
      text: trimmed.slice(0, 500),
      ts: Date.now(),
    },
  ])
  while (chat.length > MAX_CHAT) chat.delete(0)
}

/** @param {Y.Doc} doc */
export function snapshotForUi(doc) {
  const { players, chat } = initWorldDoc(doc)
  /** @type {Record<string, unknown>} */
  const playerObj = {}
  players.forEach((v, k) => {
    playerObj[k] = v
  })
  return {
    players: playerObj,
    chat: chat.toArray(),
  }
}