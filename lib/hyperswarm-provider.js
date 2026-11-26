import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import { buildHello, verifyHello } from './hello.js'
import { CH_AWARENESS, CH_HELLO, CH_YJS, FrameReader, encodeFrame } from './wire.js'

const ORIGIN_REMOTE = 'hyperswarm'

/**
 * Yjs sync + awareness over Hyperswarm duplex sockets, with signed hello handshake.
 */
export class HyperswarmYjsProvider {
  /**
   * @param {object} opts
   * @param {import('yjs').Doc} opts.doc
   * @param {awarenessProtocol.Awareness} opts.awareness
   * @param {string} opts.town
   * @param {import('./identity.js').Identity} opts.identity
   */
  constructor({ doc, awareness, town, identity }) {
    this.doc = doc
    this.awareness = awareness
    this.town = town
    this.identity = identity
    /** @type {Map<string, { socket: any, reader: FrameReader, verified: boolean }>} */
    this.peers = new Map()
    this._onUpdate = this._onDocUpdate.bind(this)
    this._onAwareness = this._onAwarenessUpdate.bind(this)
    doc.on('update', this._onUpdate)
    awareness.on('update', this._onAwarenessUpdate)
  }

  destroy() {
    this.doc.off('update', this._onUpdate)
    this.awareness.off('update', this._onAwarenessUpdate)
    for (const { socket } of this.peers.values()) socket.destroy?.()
    this.peers.clear()
  }

  get connectedPublicKeys() {
    return [...this.peers.values()]
      .filter((p) => p.verified && p.remotePublicKey)
      .map((p) => p.remotePublicKey)
  }

  /**
   * @param {any} socket Node duplex from hyperswarm
   * @param {import('hyperswarm')?} _peerInfo
   */
  attachConnection(socket, _peerInfo) {
    const id = socket.remotePublicKey?.toString('hex') || String(Math.random())
    const conn = {
      socket,
      reader: new FrameReader(),
      verified: false,
      remotePublicKey: null,
      pending: /** @type {Buffer[]} */ ([]),
    }
    this.peers.set(id, conn)

    const onData = (data) => {
      conn.reader.push(Buffer.from(data))
      let frame
      // eslint-disable-next-line no-cond-assign
      while ((frame = conn.reader.read())) this._handleFrame(conn, id, frame)
    }

    socket.on('data', onData)
    socket.on('error', () => this._drop(id))
    socket.on('close', () => this._drop(id))

    this._sendHello(conn)
    this._sendSyncStep1(conn)
  }

  _drop(id) {
    const conn = this.peers.get(id)
    if (conn) {
      try {
        conn.socket.destroy?.()
      } catch {
        /* ignore */
      }
    }
    this.peers.delete(id)
  }

  /** @param {*} conn */
  _sendHello(conn) {
    buildHello(this.identity, this.town).then((hello) => {
      const body = Buffer.from(JSON.stringify(hello), 'utf8')
      conn.socket.write(encodeFrame(CH_HELLO, body))
    })
  }

  /** @param {*} conn */
  _sendSyncStep1(conn) {
    const encoder = encoding.createEncoder()
    syncProtocol.writeSyncStep1(encoder, this.doc)
    conn.socket.write(encodeFrame(CH_YJS, encoding.toUint8Array(encoder)))
  }

  _onDocUpdate(update, origin) {
    if (origin === ORIGIN_REMOTE) return
    const encoder = encoding.createEncoder()
    syncProtocol.writeUpdate(encoder, update)
    this._broadcast(encoding.toUint8Array(encoder))
  }

  /**
   * @param {{ added: number[], updated: number[], removed: number[] }} _a
   * @param {any} origin
   */
  _onAwarenessUpdate(_a, origin) {
    if (origin === ORIGIN_REMOTE) return
    const changed = _a.added.concat(_a.updated, _a.removed)
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)
    this._broadcastAwareness(update)
  }

  /** @param {Uint8Array} yjsPayload already encoded sync message */
  _broadcast(yjsPayload) {
    for (const conn of this.peers.values()) {
      if (!conn.verified) continue
      conn.socket.write(encodeFrame(CH_YJS, yjsPayload))
    }
  }

  /** @param {Uint8Array} update */
  _broadcastAwareness(update) {
    for (const conn of this.peers.values()) {
      if (!conn.verified) continue
      conn.socket.write(encodeFrame(CH_AWARENESS, update))
    }
  }

  /**
   * @param {*} conn
   * @param {string} id
   * @param {{ channel: number, payload: Buffer }} frame
   */
  _handleFrame(conn, id, frame) {
    if (frame.channel === CH_HELLO) {
      try {
        const hello = JSON.parse(frame.payload.toString('utf8'))
        const ok = verifyHello(hello, this.town)
        if (!ok) {
          console.warn('ohmachi: rejected hello (bad signature or town)')
          this._drop(id)
          return
        }
        conn.verified = true
        conn.remotePublicKey = hello.publicKey
        for (const payload of conn.pending) {
          this._handleYjs(conn, payload)
        }
        conn.pending.length = 0
      } catch {
        this._drop(id)
      }
      return
    }

    if (frame.channel === CH_YJS) {
      if (!conn.verified) {
        conn.pending.push(frame.payload)
        return
      }
      this._handleYjs(conn, frame.payload)
      return
    }

    if (!conn.verified) return

    if (frame.channel === CH_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, frame.payload, ORIGIN_REMOTE)
    }
  }

  /** @param {*} conn */
  _handleYjs(conn, payload) {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(payload)
    syncProtocol.readSyncMessage(decoder, encoder, this.doc, ORIGIN_REMOTE)
    if (encoding.length(encoder) > 1) {
      conn.socket.write(encodeFrame(CH_YJS, encoding.toUint8Array(encoder)))
    }
  }
}