# Oh Machi (町)

Oh Machi is a cozy, peer-to-peer pixel-town simulator in the spirit of *Animal Crossing*: each player is a pixel-art character with their own lot in a shared neighborhood, where a local AI agent builds houses, yards, props, and outfits from constrained pixel-art and image-generation tools. Neighbors discover each other without a central game server, share signed assets peer to peer, and chat in real time. The **UI is intentionally light**: a static page served by the local peer daemon and opened in any browser (or an optional thin webview wrapper). Rendering uses a custom **Canvas 2D** stack inspired by [sprite-stacking](https://github.com/danielwh2/sprite-stacking); **three.js** is allowed only if a prototype shows it clearly beats canvas for the same job. No game engines. The project targets friendly Linux desktops (including [Omarchy](https://omarchy.org/)), but is not Omarchy-specific.

**Status:** Design phase — no playable build yet. Architecture, milestones, and asset format are documented below.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DESIGN.md](docs/DESIGN.md) | Goals, architecture, stack comparisons, security, and open questions |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Phased delivery plan with acceptance criteria |
| [docs/ASSET_FORMAT.md](docs/ASSET_FORMAT.md) | Draft spec for signed, content-addressed asset bundles |

## License

MIT — see [LICENSE](LICENSE).