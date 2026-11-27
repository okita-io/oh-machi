.pragma library

var LAYER_ORDER = ["ground", "props", "shell", "furniture", "agent", "overlay"]

function layerIndex(name) {
  var i = LAYER_ORDER.indexOf(name)
  return i < 0 ? 50 : i
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

function defaultWorld() {
  var w = 12
  var h = 10
  var tiles = []
  var objects = []
  var x, y

  // Yard ground
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      tiles.push({ packId: "starter", assetId: "grass", x: x, y: y, camera: "yard" })
    }
  }
  // Path to the door
  for (y = 7; y < h; y++) {
    tiles.push({ packId: "starter", assetId: "path", x: 5, y: y, camera: "yard" })
    tiles.push({ packId: "starter", assetId: "path", x: 6, y: y, camera: "yard" })
  }

  // Inside floor + walls (door gap on the south wall at x=5,6)
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      var door = y === h - 1 && (x === 5 || x === 6)
      var edge = !door && (x === 0 || y === 0 || x === w - 1 || y === h - 1)
      tiles.push({
        packId: "starter",
        assetId: edge ? "wall" : "floor",
        x: x,
        y: y,
        camera: "inside"
      })
    }
  }
  // Rug
  tiles.push({ packId: "starter", assetId: "rug", x: 5, y: 5, camera: "inside" })
  tiles.push({ packId: "starter", assetId: "rug", x: 6, y: 5, camera: "inside" })

  // Yard props
  objects.push({ id: "house-1", packId: "starter", assetId: "house", x: 4, y: 3, camera: "yard" })
  objects.push({ id: "tree-1", packId: "starter", assetId: "tree", x: 1, y: 2, camera: "yard" })
  objects.push({ id: "tree-2", packId: "starter", assetId: "tree", x: 10, y: 1, camera: "yard" })
  objects.push({ id: "bush-1", packId: "starter", assetId: "bush", x: 2, y: 7, camera: "yard" })
  objects.push({ id: "bush-2", packId: "starter", assetId: "bush", x: 9, y: 6, camera: "yard" })
  for (x = 0; x < w; x++) {
    objects.push({ id: "fence-n-" + x, packId: "starter", assetId: "fence", x: x, y: 0, camera: "yard" })
  }

  // Inside furniture
  objects.push({ id: "bed-1", packId: "starter", assetId: "bed", x: 1, y: 1, camera: "inside" })
  objects.push({ id: "bookshelf-1", packId: "starter", assetId: "bookshelf", x: 10, y: 1, camera: "inside" })
  objects.push({ id: "table-1", packId: "starter", assetId: "table", x: 5, y: 4, camera: "inside" })
  objects.push({ id: "chair-1", packId: "starter", assetId: "chair", x: 5, y: 5, camera: "inside" })
  objects.push({ id: "plant-1", packId: "starter", assetId: "plant", x: 8, y: 2, camera: "inside" })
  objects.push({ id: "plant-2", packId: "starter", assetId: "plant", x: 2, y: 7, camera: "inside" })

  return {
    version: 1,
    camera: "inside",
    lot: { w: w, h: h },
    tiles: tiles,
    objects: objects,
    agent: { name: "Machi", x: 4, y: 5, facing: "s", mood: "idle", camera: "inside" },
    selection: null,
    placeAssetId: null
  }
}

function parsePack(text) {
  try {
    return JSON.parse(text || "{}")
  } catch (e) {
    return null
  }
}

function assetDef(pack, assetId) {
  if (!pack || !pack.assets) return null
  return pack.assets[assetId] || null
}

function assetFootprint(pack, assetId) {
  var def = assetDef(pack, assetId)
  if (!def) return { w: 1, h: 1, anchorY: 0 }
  return {
    w: Math.max(1, Number(def.w) || 1),
    h: Math.max(1, Number(def.h) || 1),
    anchorY: Number(def.anchorY) || 0
  }
}

function cameraMatch(itemCamera, viewCamera) {
  return !itemCamera || itemCamera === viewCamera
}

function assetVisibleInCamera(pack, assetId, viewCamera) {
  var def = assetDef(pack, assetId)
  if (!def) return false
  var cams = def.cameras || ["inside", "yard"]
  return cams.indexOf(viewCamera) >= 0
}

function solidCells(world, pack, viewCamera) {
  var cells = {}
  var lot = world.lot || { w: 12, h: 10 }
  var i, t, o, def, fp, dx, dy, key

  var tiles = world.tiles || []
  for (i = 0; i < tiles.length; i++) {
    t = tiles[i]
    if (!cameraMatch(t.camera, viewCamera)) continue
    def = assetDef(pack, t.assetId)
    if (!def || !def.solid) continue
    cells[t.x + "," + t.y] = true
  }

  var objects = world.objects || []
  for (i = 0; i < objects.length; i++) {
    o = objects[i]
    if (!cameraMatch(o.camera, viewCamera)) continue
    def = assetDef(pack, o.assetId)
    if (!def || !def.solid) continue
    fp = assetFootprint(pack, o.assetId)
    for (dy = 0; dy < fp.h; dy++) {
      for (dx = 0; dx < fp.w; dx++) {
        // Footprint is measured from the footprint origin at (x, y - anchorY + h - 1)? 
        // We treat (x,y) as the top-left of the footprint on the grid.
        key = (o.x + dx) + "," + (o.y + dy)
        cells[key] = true
      }
    }
  }

  // Out of bounds is solid
  for (dy = -1; dy <= lot.h; dy++) {
    cells["-1," + dy] = true
    cells[lot.w + "," + dy] = true
  }
  for (dx = -1; dx <= lot.w; dx++) {
    cells[dx + ",-1"] = true
    cells[dx + "," + lot.h] = true
  }
  return cells
}

function inBounds(world, x, y) {
  var lot = world.lot || { w: 12, h: 10 }
  return x >= 0 && y >= 0 && x < lot.w && y < lot.h
}

function isWalkable(world, pack, viewCamera, x, y) {
  if (!inBounds(world, x, y)) return false
  var cells = solidCells(world, pack, viewCamera)
  return !cells[x + "," + y]
}

function pathfind(world, pack, viewCamera, sx, sy, tx, ty) {
  if (!isWalkable(world, pack, viewCamera, tx, ty)) return []
  if (sx === tx && sy === ty) return []

  var solid = solidCells(world, pack, viewCamera)
  var lot = world.lot || { w: 12, h: 10 }
  var key = function(x, y) { return x + "," + y }
  var q = [{ x: sx, y: sy }]
  var came = {}
  came[key(sx, sy)] = null
  var head = 0
  var dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]

  while (head < q.length) {
    var cur = q[head++]
    if (cur.x === tx && cur.y === ty) break
    for (var i = 0; i < dirs.length; i++) {
      var nx = cur.x + dirs[i][0]
      var ny = cur.y + dirs[i][1]
      var nk = key(nx, ny)
      if (came[nk] !== undefined) continue
      if (nx < 0 || ny < 0 || nx >= lot.w || ny >= lot.h) continue
      if (solid[nk]) continue
      came[nk] = key(cur.x, cur.y)
      q.push({ x: nx, y: ny })
    }
  }

  if (came[key(tx, ty)] === undefined) return []

  var path = []
  var ck = key(tx, ty)
  while (ck !== null) {
    var parts = ck.split(",")
    path.push({ x: Number(parts[0]), y: Number(parts[1]) })
    ck = came[ck]
  }
  path.reverse()
  if (path.length && path[0].x === sx && path[0].y === sy) path.shift()
  return path
}

function facingFromStep(from, to) {
  if (to.x > from.x) return "e"
  if (to.x < from.x) return "w"
  if (to.y > from.y) return "s"
  return "n"
}

function nextObjectId(world, prefix) {
  var n = 1
  var ids = {}
  var objects = world.objects || []
  for (var i = 0; i < objects.length; i++) ids[objects[i].id] = true
  while (ids[prefix + "-" + n]) n++
  return prefix + "-" + n
}

function canPlace(world, pack, viewCamera, assetId, x, y) {
  if (!assetVisibleInCamera(pack, assetId, viewCamera)) return false
  var fp = assetFootprint(pack, assetId)
  var solid = solidCells(world, pack, viewCamera)
  var agent = world.agent || {}
  for (var dy = 0; dy < fp.h; dy++) {
    for (var dx = 0; dx < fp.w; dx++) {
      var cx = x + dx
      var cy = y + dy
      if (!inBounds(world, cx, cy)) return false
      if (solid[cx + "," + cy]) return false
      if (agent.camera === viewCamera && agent.x === cx && agent.y === cy) return false
    }
  }
  return true
}

function placeObject(world, pack, viewCamera, assetId, x, y) {
  if (!canPlace(world, pack, viewCamera, assetId, x, y)) return null
  var next = deepCopy(world)
  var obj = {
    id: nextObjectId(next, assetId),
    packId: pack.id || "starter",
    assetId: assetId,
    x: x,
    y: y,
    camera: viewCamera
  }
  next.objects = (next.objects || []).concat([obj])
  next.selection = obj.id
  return next
}

function removeObject(world, objectId) {
  var next = deepCopy(world)
  next.objects = (next.objects || []).filter(function(o) { return o.id !== objectId })
  if (next.selection === objectId) next.selection = null
  return next
}

function objectAt(world, viewCamera, x, y, pack) {
  var objects = world.objects || []
  var best = null
  for (var i = 0; i < objects.length; i++) {
    var o = objects[i]
    if (!cameraMatch(o.camera, viewCamera)) continue
    if (o.assetId === "house") continue
    var fp = assetFootprint(pack, o.assetId)
    if (x >= o.x && x < o.x + fp.w && y >= o.y && y < o.y + fp.h) {
      best = o
    }
  }
  return best
}

function houseObject(world) {
  var objects = world.objects || []
  for (var i = 0; i < objects.length; i++) {
    if (objects[i].assetId === "house") return objects[i]
  }
  return null
}

function buildDrawList(world, pack, viewCamera, scale, tileSize) {
  var list = []
  var ts = tileSize || (pack && pack.tileSize) || 16
  var i, t, o, def, fp, px, py, depth, sheet, frame

  var tiles = world.tiles || []
  for (i = 0; i < tiles.length; i++) {
    t = tiles[i]
    if (!cameraMatch(t.camera, viewCamera)) continue
    if (!assetVisibleInCamera(pack, t.assetId, viewCamera)) continue
    def = assetDef(pack, t.assetId)
    if (!def) continue
    list.push({
      kind: "tile",
      key: "t-" + i + "-" + t.assetId,
      packId: t.packId || pack.id,
      assetId: t.assetId,
      file: def.file,
      x: t.x * ts * scale,
      y: t.y * ts * scale,
      z: layerIndex(def.layer) * 10000 + t.y * 100 + t.x,
      w: ts * scale,
      h: ts * scale,
      frame: -1,
      frameW: 0,
      frameH: 0
    })
  }

  var objects = world.objects || []
  for (i = 0; i < objects.length; i++) {
    o = objects[i]
    if (!cameraMatch(o.camera, viewCamera)) continue
    if (!assetVisibleInCamera(pack, o.assetId, viewCamera)) continue
    def = assetDef(pack, o.assetId)
    if (!def) continue
    fp = assetFootprint(pack, o.assetId)
    // Draw so the footprint bottom sits on the grid cell row.
    var imgH = (def.sheet ? def.sheet.frameH : (fp.h * ts))
    // Prefer natural pixel height when file is taller (tree/house).
    var drawH = imgH
    if (!def.sheet) {
      // Approximate: w tiles wide, height from declared h tiles unless file taller —
      // callers can override via PixelStack natural size; here use footprint.
      drawH = fp.h * ts
      // Special case known taller sprites via file naming / anchor
      if (o.assetId === "tree") drawH = 24
      else if (o.assetId === "house") drawH = 40
      else if (o.assetId === "bookshelf") drawH = 24
      else if (o.assetId === "bed") { /* 32x16 */ }
    }
    var drawW = def.sheet ? def.sheet.frameW : (o.assetId === "house" ? 48 : o.assetId === "bed" ? 32 : fp.w * ts)
    px = o.x * ts * scale
    py = (o.y + fp.h) * ts * scale - drawH * scale
    depth = layerIndex(def.layer) * 10000 + (o.y + fp.h - 1) * 100 + o.x
    list.push({
      kind: "object",
      key: "o-" + o.id,
      id: o.id,
      packId: o.packId || pack.id,
      assetId: o.assetId,
      file: def.file,
      x: px,
      y: py,
      z: depth,
      w: drawW * scale,
      h: drawH * scale,
      frame: -1,
      frameW: 0,
      frameH: 0,
      hit: !!def.hit
    })
  }

  var agent = world.agent
  if (agent && cameraMatch(agent.camera || "inside", viewCamera)) {
    def = assetDef(pack, "agent")
    if (def) {
      sheet = def.sheet || { frameW: 16, frameH: 16, frames: { s: 0 } }
      frame = sheet.frames[agent.facing] !== undefined ? sheet.frames[agent.facing] : 0
      list.push({
        kind: "agent",
        key: "agent",
        packId: "starter",
        assetId: "agent",
        file: def.file,
        x: agent.x * ts * scale,
        y: agent.y * ts * scale,
        z: layerIndex("agent") * 10000 + agent.y * 100 + agent.x,
        w: sheet.frameW * scale,
        h: sheet.frameH * scale,
        frame: frame,
        frameW: sheet.frameW,
        frameH: sheet.frameH
      })
    }
  }

  if (world.selection) {
    for (i = 0; i < objects.length; i++) {
      o = objects[i]
      if (o.id !== world.selection) continue
      if (!cameraMatch(o.camera, viewCamera)) continue
      def = assetDef(pack, "select")
      fp = assetFootprint(pack, o.assetId)
      if (def) {
        for (var dy = 0; dy < fp.h; dy++) {
          for (var dx = 0; dx < fp.w; dx++) {
            list.push({
              kind: "overlay",
              key: "sel-" + o.id + "-" + dx + "-" + dy,
              packId: "starter",
              assetId: "select",
              file: def.file,
              x: (o.x + dx) * ts * scale,
              y: (o.y + dy) * ts * scale,
              z: layerIndex("overlay") * 10000 + (o.y + dy) * 100 + o.x + dx,
              w: ts * scale,
              h: ts * scale,
              frame: -1,
              frameW: 0,
              frameH: 0
            })
          }
        }
      }
    }
  }

  list.sort(function(a, b) {
    if (a.z !== b.z) return a.z - b.z
    return String(a.key).localeCompare(String(b.key))
  })
  return list
}

function moodGlyph(mood) {
  if (mood === "walk") return "🚶"
  if (mood === "happy") return "☺"
  if (mood === "sleep") return "💤"
  return "🏠"
}
