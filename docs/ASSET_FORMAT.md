# Oh Machi — Asset Bundle Format (draft v0.1)

This spec defines a **signed, content-addressed** bundle for lots, props, characters, and tile data. Bundles are immutable once published; updates are new manifest hashes. Transport (Hyperswarm, Hypercore, file share) is separate from this format.

**Status:** Draft for Milestone 1. Fields may change with a bumped `format_version`.

World positions, facing, draw order, and projection use the **coordinate system** in [DESIGN.md — Coordinate system](DESIGN.md#coordinate-system) (+X east, +Y south, +Z up; tile units on the ground plane).

---

## Design principles

1. **Content addressing** — The bundle ID is the hash of the canonical manifest bytes (see [Hashing](#hashing)).
2. **Signatures bind identity** — The publisher’s Ed25519 public key must match the signer of the manifest and owns the `lot_id` in neighborhood policy.
3. **PNG-first payloads** — v0.1 assets are PNG (optionally DEFLATE’d); no executables or scripts in bundles.
4. **Neighborhood constraints** — Manifest references a `palette_id` and `grid` understood by all clients in that hood.

---

## Bundle layout

A bundle is a directory or tar archive:

```
<bundle>/
  manifest.json          # canonical JSON (signed)
  manifest.sig           # detached Ed25519 signature over manifest bytes
  assets/
    <asset_id>.<ext>     # PNG files, named by asset_id from manifest
```

For wire transfer, bundles may be concatenated as:

```
[ manifest.json | manifest.sig | asset file bytes in manifest order ]
```

with lengths declared only in `manifest.json` (no zip slip; relative paths forbidden).

---

## Manifest schema (`format_version: "0.1"`)

```json
{
  "format_version": "0.1",
  "manifest_schema": 1,
  "bundle_kind": "lot",
  "bundle_id": "<hex sha256 of canonical manifest without bundle_id and signature fields>",
  "created_at": "2026-11-22T00:00:00Z",
  "publisher": {
    "algorithm": "Ed25519",
    "public_key": "<hex 32-byte pubkey>"
  },
  "neighborhood": {
    "palette_id": "<hash or well-known id>",
    "grid_cell_px": 16,
    "lot_id": "<stable id: hash(pubkey) || slot index>"
  },
  "assets": [
    {
      "asset_id": "house_main",
      "type": "sprite_stack",
      "path": "assets/house_main.png",
      "content_hash": "<hex sha256 of raw file bytes>",
      "byte_length": 12345,
      "sprite_stack": {
        "slice_count": 36,
        "slice_width": 24,
        "slice_height": 18,
        "squash": 0.75,
        "layer_spacing": 1.0,
        "stack_axis": "z",
        "companion": {
          "normals": { "path": "assets/house_main.normals.png", "content_hash": "...", "byte_length": 0 },
          "emissive": { "path": "assets/house_main.emissive.png", "content_hash": "...", "byte_length": 0 }
        }
      }
    },
    {
      "asset_id": "yard_tiles",
      "type": "tile_layer",
      "path": "assets/yard_tiles.png",
      "content_hash": "...",
      "byte_length": 0,
      "tile_layer": {
        "grid_w": 16,
        "grid_h": 16,
        "tile_size_px": 16,
        "layer": "ground"
      }
    }
  ],
  "lot_placement": {
    "origin_tile": { "x": 0, "y": 0 },
    "footprint_tiles": { "w": 16, "h": 16 },
    "stack_instances": [
      {
        "asset_id": "house_main",
        "foot_tile": { "x": 4, "y": 6 },
        "foot_z": 0,
        "facing_deg": 0
      }
    ]
  },
  "metadata": {
    "title": "starter house",
    "agent_model": "optional string",
    "tool_versions": { "sprite_stacking": "1.0.0" }
  }
}
```

### `bundle_kind` values (v0.1)

| Kind | Purpose |
|------|---------|
| `lot` | Full lot: tiles + placed props + boundaries |
| `prop` | Single reusable prop (may still use `sprite_stack`) |
| `character` | Avatar appearance + animation sheets |
| `palette` | Shared neighborhood colors (optional separate bundle) |

### Asset `type` values (v0.1)

| Type | Description |
|------|-------------|
| `sprite_stack` | Horizontal strip PNG from sprite-stacking (`slice_count` × `slice_width` × `slice_height` pixels); see [Sprite stack strips](#sprite-stack-strips) |
| `tile_layer` | Regular grid of tiles on integer lot coordinates; see [Tile layers](#tile-layers) |
| `sprite_sheet` | Pre-baked 16 yaw frames; `facing_offset_deg` (default `0`) = which frame is east (+X); see [Coordinate system](DESIGN.md#facing-and-rotation) |
| `raw_views` | Four-view sheet before stacking (debug / reprocess only; clients may ignore at runtime) |

---

## Palette

Neighborhood palette may be inline or referenced:

**Option A — embedded in hood genesis (CRDT):** list of `{ "index": 0, "hex": "#3d5a45" }`.

**Option B — `palette` bundle:** separate signed bundle; `palette_id` in lot manifest = its `bundle_id`.

Validation rules:

- Tile layers and slice strips must only use colors present in the active palette (clients may reject or quantize with warning).
- Alpha allowed; fully transparent pixels ignored in collision.

---

## Hashing

1. Build JSON object **without** `bundle_id` field (or with it omitted).
2. **Canonicalize** UTF-8 JSON: keys sorted lexicographically at all levels, no insignificant whitespace, numbers in minimal form (implementation must document exact library — recommend RFC 8785 or a pinned `json-canonicalize` version).
3. `bundle_id = SHA-256(canonical_manifest_bytes)` encoded as lowercase hex.
4. For each asset file: `content_hash = SHA-256(raw_bytes)`; must match actual file on disk.

Clients **must** verify all `content_hash` entries after download before trusting render or collision.

---

## Signing

- Sign **canonical manifest bytes** (same bytes used before inserting `bundle_id`, or sign the final manifest including `bundle_id` — pick one; v0.1 uses **final manifest JSON with `bundle_id` set**, canonicalized, as signed payload; document in code when implementing).
- **Algorithm:** Ed25519 (EdDSA pure ed25519, 64-byte signature).
- **Encoding:** `manifest.sig` is raw 64 bytes or base64url in sidecar; detached from JSON.
- **Verification:** `public_key` in manifest must verify signature; neighborhood policy must confirm `publisher.public_key` owns `lot_id`.

**Recommended signing payload (v0.1 decision):**

```
signed_bytes = UTF-8( canonical_json( manifest including bundle_id ) )
```

Publishers rotate keys only by claiming a new lot slot or explicit neighborhood migration (TBD).

---

## Tile / slice strips

### Tile layers

- PNG stores a **regular grid** of `tile_size_px` (16 or 32) aligned pixels.
- `grid_w` × `grid_h` is the logical lot size in **tiles** on the ground plane (+X east, +Y south per [DESIGN.md](DESIGN.md#coordinate-system)); not necessarily the full PNG dimensions (PNG may include padding).
- Tile index `(0, 0)` is the **north-west** corner of the layer: minimum X and minimum Y within the layer’s local grid.
- `neighborhood.grid_cell_px` and `tile_layer.tile_size_px` should match unless the client applies explicit scaling.
- Collision and walkability maps may be added in v0.2 as `type: "nav_mask"`.

### Sprite stack strips

Per [danielwh2/sprite-stacking](https://github.com/danielwh2/sprite-stacking):

- PNG is a **horizontal concatenation** of slice images, ground slice leftmost, each slice `slice_width` × `slice_height`.
- `slice_count` derived from height of carved volume; clients verify `image_width == slice_count * slice_width`.
- Optional **normals** strip: same layout; RGB encodes unit normals (see slicer `compute_normals`).
- Optional **emissive** strip: same layout; RGBA emissive mask.

**World placement** (with anchor at `foot_tile` / `foot_z` from `lot_placement.stack_instances`):

| Field | Meaning |
|-------|---------|
| `layer_spacing` | World-tile distance between slice `i` and `i+1` along **+Z** (default axis). |
| `squash` | Camera pitch factor for projection `screen_y ∝ squash * (y - z)` (see DESIGN). |
| `stack_axis` | `"z"` (default): stack slices vertically. `"y"`: optional client-only extrusion along +Y with darkening (shadow/thickness trick; strip unchanged). |

Slice `i` world height: `z = foot_z + i * layer_spacing` when `stack_axis` is `"z"`.

**`lot_placement.stack_instances`** fields:

| Field | Type | Meaning |
|-------|------|---------|
| `asset_id` | string | Reference into `assets[]`. |
| `foot_tile` | `{ x, y }` int | Ground footprint anchor on the lot grid (east/south positive). |
| `foot_z` | number | Base elevation in world tiles (default `0`). |
| `facing_deg` | number | Yaw CCW from above; `0` = facing +X (east); matches 16-dir sheets. |

Pre-baked `sprite_sheet` may replace runtime stacking; set `facing_offset_deg` so frame `0` is east when `facing_deg = 0`.

---

## Versioning and compatibility

| Field | Meaning |
|-------|---------|
| `format_version` | Semver string for entire bundle spec |
| `manifest_schema` | Integer incremented on breaking manifest shape changes |

Clients reject unknown major `format_version` with explicit UI error. Minor versions may add optional fields.

---

## Size limits (recommended defaults)

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max manifest size | 256 KiB | Prevent abuse |
| Max single asset | 8 MiB | Large sprite sheets |
| Max assets per lot bundle | 64 | Agent complexity |
| Max bundle total | 32 MiB | Laptop cache friendliness |

Daemons may enforce stricter limits.

---

## Replication hints (non-normative)

Peers gossip:

```json
{
  "lot_id": "...",
  "head_manifest_hash": "<bundle_id>",
  "publisher_pubkey": "<hex>",
  "seq": 3
}
```

Fetch protocol: request `bundle_id` → respond with manifest + files or block ranges. Content hashes are verified independently of transport.

Hypercore/Hyperdrive may store blobs keyed by publisher log, but **integrity anchor remains `bundle_id` hash and signature**, not Hyperblob positional IDs alone.

---

## Example minimal lot (Milestone 1)

Single flat tile layer, no sprite stack:

```json
{
  "format_version": "0.1",
  "manifest_schema": 1,
  "bundle_kind": "lot",
  "bundle_id": "…computed…",
  "created_at": "2026-11-22T12:00:00Z",
  "publisher": { "algorithm": "Ed25519", "public_key": "…" },
  "neighborhood": {
    "palette_id": "default-16",
    "grid_cell_px": 16,
    "lot_id": "lot_0_…pubkey…"
  },
  "assets": [
    {
      "asset_id": "ground",
      "type": "tile_layer",
      "path": "assets/ground.png",
      "content_hash": "…",
      "byte_length": 4096,
      "tile_layer": { "grid_w": 16, "grid_h": 16, "tile_size_px": 16, "layer": "ground" }
    }
  ],
  "lot_placement": {
    "origin_tile": { "x": 0, "y": 0 },
    "footprint_tiles": { "w": 16, "h": 16 },
    "stack_instances": []
  },
  "metadata": { "title": "m1 fixture lot" }
}
```

---

## Open spec questions

1. Exact JSON canonicalization library and test vectors.
2. Whether to embed signature inside `manifest.json` vs always use `manifest.sig`.
3. Compression: gzip tarball vs raw PNG only for v0.1.
4. Multi-resolution assets (2× skins for HiDPI) in one bundle vs separate hashes.
5. `raw_views` retention policy (privacy: agent prompts in metadata).