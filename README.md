# Oh Machi (町)

Oh Machi is a cozy, peer-to-peer pixel-town simulator in the spirit of *Animal Crossing*: each player is a pixel-art character with their own lot in a shared neighborhood, where a local AI agent builds houses, yards, props, and outfits from constrained pixel-art and image-generation tools. Neighbors discover each other without a central game server, share signed assets peer to peer, and chat in real time. The **UI is intentionally light**: a static page served by the local peer daemon and opened in any browser (or an optional thin webview wrapper). Rendering uses a custom **Canvas 2D** stack inspired by [sprite-stacking](https://github.com/danielwh2/sprite-stacking); **three.js** is allowed only if a prototype shows it clearly beats canvas for the same job. No game engines. The project targets friendly Linux desktops (including [Omarchy](https://omarchy.org/)), but is not Omarchy-specific.

**Status:** Early networking milestone — a Node **town daemon** serves a browser UI, joins towns over **Hyperswarm**, and syncs players + chat with **Yjs**. Lots and agent tooling are not implemented yet.

## Quick start (networking demo)

Requires **Node 20+**.

```bash
npm install
npm test                    # two daemons on a local HyperDHT testnet (CI-safe)
node bin/ohmachi-daemon.js --town my-hood
```

Open `http://127.0.0.1:8765/` (or your `OHMACHI_PORT`). Identity is created at `~/.config/ohmachi/identity.json` (override with `OHMACHI_CONFIG_DIR`).

### Two instances on one machine

Use separate config dirs and ports so each player gets its own Ed25519 key:

```bash
OHMACHI_CONFIG_DIR=/tmp/ohmachi-a OHMACHI_PORT=8765 node bin/ohmachi-daemon.js --town my-hood
OHMACHI_CONFIG_DIR=/tmp/ohmachi-b OHMACHI_PORT=8766 node bin/ohmachi-daemon.js --town my-hood
```

Open `http://127.0.0.1:8765/` and `http://127.0.0.1:8766/` in two browser windows. You should see each peer listed after Hyperswarm connects (public DHT bootstrap; may take up to ~60s on some networks).

### Two machines (LAN or tailnet)

1. Pick the same `--town` name on both machines (topic key is derived from it — see [docs/DESIGN.md](docs/DESIGN.md)).
2. Start the daemon on each host; open the local UI URL.
3. Optional: the daemon advertises `_ohmachi._udp` via mDNS with the town fingerprint (full invite secret is never broadcast).
4. Ensure UDP egress for HyperDHT (public bootstrap) or pass the same `--bootstrap host:port` on both sides if you run a private bootstrap.

Firewalls must allow the daemon’s DHT traffic; there is no central Oh Machi relay.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DESIGN.md](docs/DESIGN.md) | Goals, architecture, stack comparisons, security, and open questions |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Phased delivery plan with acceptance criteria |
| [docs/ASSET_FORMAT.md](docs/ASSET_FORMAT.md) | Draft spec for signed, content-addressed asset bundles |

## Implementation layout

| Path | Purpose |
|------|---------|
| `bin/ohmachi-daemon.js` | CLI entry |
| `lib/town-daemon.js` | HTTP UI, WebSocket, Hyperswarm, Yjs |
| `lib/hyperswarm-provider.js` | y-protocols sync + awareness over swarm sockets |
| `lib/identity.js` | Ed25519 key file |
| `ui/` | Browser canvas grid + chat |
| `test/integration.test.js` | Two-peer sync test (`hyperdht/testnet.js`) |

## License

MIT — see [LICENSE](LICENSE).