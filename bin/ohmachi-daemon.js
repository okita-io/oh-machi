#!/usr/bin/env node
import { TownDaemon } from '../lib/town-daemon.js'
import { defaultPort } from '../lib/config.js'

function parseArgs(argv) {
  /** @type {{ town: string, port: number, bootstrap: string[] }} */
  const out = { town: 'demo', port: defaultPort(), bootstrap: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--town' && argv[i + 1]) out.town = argv[++i]
    else if (a === '--port' && argv[i + 1]) out.port = Number(argv[++i])
    else if (a === '--bootstrap' && argv[i + 1]) out.bootstrap = argv[++i].split(',').filter(Boolean)
    else if (a === '--help' || a === '-h') {
      console.log(`ohmachi-daemon — Oh Machi town daemon

Usage: ohmachi-daemon --town NAME [--port 8765] [--bootstrap host:port,...]

Environment:
  OHMACHI_CONFIG_DIR  identity + local data (default ~/.config/ohmachi)
  OHMACHI_PORT        default HTTP port
`)
      process.exit(0)
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const daemon = new TownDaemon({
  town: args.town,
  port: args.port,
  bootstrap: args.bootstrap.length ? args.bootstrap : undefined,
})

await daemon.start()
const url = `http://127.0.0.1:${args.port}/`
console.log(`Oh Machi daemon running for town "${daemon.town}"`)
console.log(`  UI:    ${url}`)
console.log(`  Self:  ${daemon.identity?.publicKeyHex}`)
console.log(`  Topic: ${daemon.topicKey.toString('hex').slice(0, 16)}…`)
if (args.bootstrap.length) console.log(`  DHT:   ${args.bootstrap.join(', ')}`)
else console.log(`  DHT:   public bootstrap (default)`)

const shutdown = async () => {
  await daemon.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)