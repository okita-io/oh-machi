import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import createTestnet from 'hyperdht/testnet.js'
import DHT from 'hyperdht'
import { TownDaemon } from '../lib/town-daemon.js'
import { appendChat, initWorldDoc, snapshotForUi } from '../lib/world-doc.js'

test('two daemons sync Yjs chat over hyperswarm testnet', async (t) => {
  const testnet = await createTestnet(3, { host: '127.0.0.1' })
  t.after(() => testnet.destroy())

  const bootstrap = testnet.bootstrap
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ohmachi-test-'))

  const dhtA = testnet.createNode()
  const dhtB = testnet.createNode()
  await dhtA.fullyBootstrapped()
  await dhtB.fullyBootstrapped()

  const dirA = path.join(tmp, 'a')
  const dirB = path.join(tmp, 'b')
  await fs.mkdir(dirA)
  await fs.mkdir(dirB)

  const daemonA = new TownDaemon({
    town: 'ci-hood',
    port: 0,
    configDir: dirA,
    bootstrap,
    dht: dhtA,
    mdns: false,
  })
  const daemonB = new TownDaemon({
    town: 'ci-hood',
    port: 0,
    configDir: dirB,
    bootstrap,
    dht: dhtB,
    mdns: false,
  })

  t.after(async () => {
    await daemonA.stop()
    await daemonB.stop()
  })

  await daemonA.start()
  await daemonB.start()

  const connected = await daemonA.waitFor(45_000, (d) => (d.swarm?.connections?.size ?? 0) >= 1)
  const connectedB = await daemonB.waitFor(45_000, (d) => (d.swarm?.connections?.size ?? 0) >= 1)
  assert.ok(connected, 'daemon A should connect to at least one peer')
  assert.ok(connectedB, 'daemon B should connect to at least one peer')

  const verified = await daemonA.waitFor(
    15_000,
    (d) => (d.provider?.connectedPublicKeys?.length ?? 0) >= 1
  )
  assert.ok(verified, 'daemon A should verify peer hello')

  const { chat } = initWorldDoc(daemonA.doc)
  appendChat(chat, daemonA.identity.publicKeyHex, 'integration hello')

  const synced = await daemonB.waitFor(10_000, (d) => {
    const snap = snapshotForUi(d.doc)
    return snap.chat.some((m) => m.text === 'integration hello')
  })
  assert.ok(synced, 'daemon B should receive chat via Yjs')

  const { players } = initWorldDoc(daemonA.doc)
  const self = daemonA.identity.publicKeyHex
  players.set(self, {
    position: { x: 12.5, y: 9.25, z: 0 },
    facing_deg: 90,
    last_seen: Date.now(),
  })

  const moved = await daemonB.waitFor(10_000, (d) => {
    const p = snapshotForUi(d.doc).players[self]
    return p && Math.abs(p.position.x - 12.5) < 0.01 && p.facing_deg === 90
  })
  assert.ok(moved, 'daemon B should receive player map update via Yjs')
})