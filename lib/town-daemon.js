import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import Hyperswarm from 'hyperswarm'
import DHT from 'hyperdht'
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { WebSocketServer } from 'ws'
import { defaultPort, configDir } from './config.js'
import { loadOrCreateIdentity } from './identity.js'
import { townTopicKey, townFingerprint, normalizeTownName } from './topic.js'
import { HyperswarmYjsProvider } from './hyperswarm-provider.js'
import { initWorldDoc, upsertLocalPlayer, appendChat, snapshotForUi } from './world-doc.js'
import { advertiseOhmachi } from './mdns.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_ROOT = path.join(__dirname, '..', 'ui')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

/**
 * @typedef {object} TownDaemonOptions
 * @property {string} town
 * @property {number} [port]
 * @property {string} [configDir]
 * @property {string[]} [bootstrap] HyperDHT bootstrap addresses
 * @property {import('hyperdht')?} [dht] injected DHT (tests)
 * @property {boolean} [mdns=true]
 */

export class TownDaemon {
  /** @param {TownDaemonOptions} options */
  constructor(options) {
    this.town = normalizeTownName(options.town)
    this.port = options.port ?? defaultPort()
    this.dataDir = options.configDir ?? configDir()
    this.bootstrap = options.bootstrap?.map((b) =>
      typeof b === 'string' ? b : `${b.host}:${b.port}`
    )
    this.injectDht = options.dht
    this.useMdns = options.mdns !== false

    /** @type {import('./identity.js').Identity | null} */
    this.identity = null
    /** @type {Hyperswarm | null} */
    this.swarm = null
    /** @type {HyperswarmYjsProvider | null} */
    this.provider = null
    /** @type {Y.Doc | null} */
    this.doc = null
    /** @type {awarenessProtocol.Awareness | null} */
    this.awareness = null
    /** @type {import('node:http').Server | null} */
    this.httpServer = null
    /** @type {WebSocketServer | null} */
    this.wss = null
    /** @type {{ stop(): void } | null} */
    this.mdns = null
    this.topicKey = townTopicKey(this.town)
    this._started = false
    this._local = { x: 8, y: 8, z: 0, facing_deg: 0 }
  }

  async start() {
    if (this._started) return this
    this.identity = await loadOrCreateIdentity(this.dataDir)

    this.doc = new Y.Doc()
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.awareness.setLocalState({
      publicKey: this.identity.publicKeyHex,
      town: this.town,
    })

    const { players, chat } = initWorldDoc(this.doc)
    upsertLocalPlayer(players, this.identity.publicKeyHex, {
      position: { x: this._local.x, y: this._local.y, z: this._local.z },
      facing_deg: this._local.facing_deg,
    })

    const dhtOpts = this.bootstrap?.length ? { bootstrap: this.bootstrap } : {}
    const dht = this.injectDht || new DHT(dhtOpts)
    this.swarm = new Hyperswarm({ dht })

    this.provider = new HyperswarmYjsProvider({
      doc: this.doc,
      awareness: this.awareness,
      town: this.town,
      identity: this.identity,
    })

    this.swarm.on('connection', (socket) => {
      this.provider.attachConnection(socket)
      this._broadcastUi()
    })

    const discovery = this.swarm.join(this.topicKey, { server: true, client: true })
    await discovery.flushed()

    await this._startHttp()

    if (this.useMdns) {
      this.mdns = advertiseOhmachi({
        port: this.port,
        fingerprint: townFingerprint(this.topicKey),
        town: this.town,
      })
    }

    this.doc.on('update', () => this._broadcastUi())
    this._started = true
    return this
  }

  async _startHttp() {
    const self = this
    this.httpServer = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${self.port}`)
        if (url.pathname === '/api/state' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(self.getPublicState()))
          return
        }
        let filePath = url.pathname === '/' ? '/index.html' : url.pathname
        if (filePath.includes('..')) {
          res.writeHead(400)
          res.end('bad path')
          return
        }
        const abs = path.join(UI_ROOT, filePath)
        const data = await fs.readFile(abs)
        const ext = path.extname(abs)
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    })

    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' })

    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', ...self.getPublicState() }))
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw))
          self._handleClientMessage(msg)
        } catch {
          /* ignore */
        }
      })
    })

    await new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, '127.0.0.1', (err) => (err ? reject(err) : resolve()))
    })
    const addr = this.httpServer.address()
    if (addr && typeof addr === 'object') this.port = addr.port
  }

  getPublicState() {
    const snap = snapshotForUi(this.doc)
    return {
      town: this.town,
      self: this.identity.publicKeyHex,
      topicFingerprint: townFingerprint(this.topicKey),
      swarmPeers: this.swarm?.connections?.size ?? 0,
      verifiedPeers: this.provider?.connectedPublicKeys ?? [],
      players: snap.players,
      chat: snap.chat,
    }
  }

  /** @param {object} msg */
  _handleClientMessage(msg) {
    if (!this.doc || !this.identity) return
    const { players, chat } = initWorldDoc(this.doc)
    if (msg.type === 'move') {
      this._local = {
        x: Number(msg.x),
        y: Number(msg.y),
        z: Number(msg.z ?? 0),
        facing_deg: Number(msg.facing_deg ?? 0),
      }
      upsertLocalPlayer(players, this.identity.publicKeyHex, {
        position: { x: this._local.x, y: this._local.y, z: this._local.z },
        facing_deg: this._local.facing_deg,
      })
      this._broadcastUi()
    } else if (msg.type === 'chat' && msg.text) {
      appendChat(chat, this.identity.publicKeyHex, msg.text)
      this._broadcastUi()
    }
  }

  _broadcastUi() {
    const payload = JSON.stringify({ type: 'state', ...this.getPublicState() })
    this.wss?.clients.forEach((c) => {
      if (c.readyState === 1) c.send(payload)
    })
  }

  /**
   * @param {number} ms
   * @param {(self: TownDaemon) => boolean} predicate
   */
  async waitFor(ms, predicate) {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (predicate(this)) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return predicate(this)
  }

  async stop() {
    this.mdns?.stop()
    this.wss?.close()
    await new Promise((resolve) => this.httpServer?.close(() => resolve()))
    this.provider?.destroy()
    await this.swarm?.destroy()
    if (this.injectDht) await this.injectDht.destroy?.()
    this._started = false
  }
}