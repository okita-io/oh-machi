# Oh Machi (町)

A cozy pixel house for [Omarchy](https://omarchy.org/): an ambient desktop lot
plus a bar panel where the **local Omarchy LLM** lives as the main resident.
Built first around a **pixel-stack** renderer; optional remote art agents can
refine pack sprites and deliver them over the network (e.g. Tailscale).

Plugin id: `alexokita.oh-machi`

> Status: 0.1.0 — single local house, NPC walk/place loop. Resident LLM not
> wired yet (see Goals).

## Goals

1. **Local LLM as the householder** — The Omarchy-installed local model
   (typically [Ollama](https://ollama.com/) via `omarchy install ai` / the AI
   menu) is the primary resident of the apartment. The pixel avatar is its
   body: mood, idle chatter, reactions to furniture, and later mail all come
   from that on-machine model — not a cloud agent by default.
2. **Cozy desk presence** — Ambient yard on the desktop + bar chip/panel so
   the resident is always “home” without stealing focus.
3. **Pixel-stack world** — Layered orthographic tiles/props so packs of trees,
   furniture, and sprites can drop in without rewriting the shell.
4. **Art pipeline (optional)** — An external pixel artist agent can generate
   pack PNGs and drop them into `~/Downloads` (or another inbox) for import;
   Oh Machi consumes those assets and does not run the artist in-process.
5. **Later: multi-house town** — Each house a user; house-to-house messages;
   shareable/purchasable packs. The local LLM remains *your* house’s resident;
   neighbors are other users’ residents.

Non-goals for the near term: replacing Omarchy’s coding agents, embedding a
full chat IDE in the bar, or requiring a remote GPU for day-to-day residency.

## Install

Clone this repo, then:

```sh
omarchy plugin add "$(pwd)" --enable
omarchy bar put alexokita.oh-machi --section right
```

For live editing, sync into the plugin dir (Quickshell loads best from a real
directory under `~/.config/omarchy/plugins/`, not a symlink outside it):

```sh
rsync -a --delete --exclude .git --exclude .claude --exclude .cursor \
  ./ ~/.config/omarchy/plugins/alexokita.oh-machi/
omarchy-shell shell rescanPlugins
```

Remove with `omarchy plugin remove alexokita.oh-machi`.

Local LLM (resident) when you are ready to wire it:

```sh
# From Omarchy menu: Install → AI → Ollama  (or)
omarchy install ai   # then pull a model, e.g. ollama pull <model>
```

## Use (today)

- **Desktop**: a miniature yard sits bottom-right. Click the house to open the panel (inside view).
- **Bar chip** `🏠`: left click toggles the house panel; middle click flips yard / inside.
- **Inside the panel**
  - Left click floor → Machi walks (grid pathfind)
  - Choose a starter asset, then left click to place
  - Middle click an object to select; left click again to pick it up for re-place
  - Right click an object to remove it
  - `I` / `Y` switch camera; Esc clears the place tool

World state lives at `~/.local/state/omarchy/oh-machi/world.json`.

## Pixel stack

Layers (back → front): ground → props → shell → furniture → agent → overlay.

Drawables are `{ packId, assetId, x, y, … }` so future downloadable packs drop into `packs/<id>/` with a `pack.json` the same shape as `packs/starter/`.

Core files: `PixelStack.qml`, `SpriteSheet.qml`, `WorldModel.js`, plus `Service.qml` (world + ambient lot) and `BarWidget.qml` / `Panel.qml` (house UI).

## IPC

```sh
omarchy-shell alexokita.oh-machi toggle
omarchy-shell alexokita.oh-machi inside
omarchy-shell alexokita.oh-machi yard
omarchy-shell alexokita.oh-machi status
omarchy-shell alexokita.oh-machi reset
```

## Roadmap sketch

| Phase | What |
|-------|------|
| Now | Pixel house, place/walk, ambient lot |
| Next | Discover local Ollama (or Omarchy local endpoint), bind avatar mood + short speech bubbles to the model |
| Soon | Import packs from `~/Downloads` (artist drops), resident memory in world state |
| Later | Multi-house map, mail between houses, pack store |

## License

MIT — see [LICENSE](LICENSE).
