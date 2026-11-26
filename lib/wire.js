/** Length-prefixed frames: [u32 BE length][u8 channel][payload...] */

export const CH_YJS = 0
export const CH_AWARENESS = 1
export const CH_HELLO = 2

export class FrameReader {
  constructor() {
    /** @type {Buffer[]} */
    this._chunks = []
    this._len = 0
  }

  /** @param {Buffer} chunk */
  push(chunk) {
    this._chunks.push(chunk)
    this._len += chunk.length
  }

  /** @returns {{ channel: number, payload: Buffer } | null} */
  read() {
    if (this._len < 4) return null
    const buf = Buffer.concat(this._chunks, this._len)
    const frameLen = buf.readUInt32BE(0)
    if (buf.length < 4 + frameLen) return null
    const frame = buf.subarray(4, 4 + frameLen)
    const rest = buf.subarray(4 + frameLen)
    this._chunks = rest.length ? [rest] : []
    this._len = rest.length
    const channel = frame[0]
    return { channel, payload: frame.subarray(1) }
  }
}

/**
 * @param {number} channel
 * @param {Buffer | Uint8Array} payload
 */
export function encodeFrame(channel, payload) {
  const body = Buffer.concat([Buffer.from([channel]), Buffer.from(payload)])
  const header = Buffer.alloc(4)
  header.writeUInt32BE(body.length, 0)
  return Buffer.concat([header, body])
}