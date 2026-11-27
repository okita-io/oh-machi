import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "WorldModel.js" as WorldModel

Item {
  id: root

  property var shell: null

  readonly property string home: Quickshell.env("HOME")
  readonly property string stateDir: home + "/.local/state/omarchy/oh-machi"
  readonly property string worldPath: stateDir + "/world.json"
  readonly property string pluginDir: {
    var u = Qt.resolvedUrl(".")
    return String(u).replace(/^file:\/\//, "").replace(/\/$/, "")
  }
  readonly property string packDir: pluginDir + "/packs/starter"
  readonly property string packPath: packDir + "/pack.json"

  property var pack: ({})
  property var world: WorldModel.defaultWorld()
  property bool worldLoaded: false
  property bool packLoaded: false
  property bool persistReady: false
  property string lastError: ""

  // Agent walk animation
  property var walkQueue: []
  property bool walking: false

  readonly property string agentMood: world && world.agent ? (world.agent.mood || "idle") : "idle"
  readonly property string agentName: world && world.agent ? (world.agent.name || "Machi") : "Machi"
  readonly property string camera: world && world.camera ? world.camera : "inside"
  readonly property var placeables: {
    if (!pack || !pack.palette) return []
    return pack.palette.placeable || []
  }

  function ensureStateDir() {
    if (!mkdirProc.running) mkdirProc.running = true
  }

  function applyWorldText(text) {
    try {
      var parsed = JSON.parse(text || "")
      if (!parsed || typeof parsed !== "object") throw new Error("invalid world")
      if (!parsed.lot || !parsed.agent) throw new Error("incomplete world")
      root.world = parsed
      root.worldLoaded = true
      root.lastError = ""
    } catch (e) {
      root.world = WorldModel.defaultWorld()
      root.worldLoaded = true
      root.lastError = ""
      persist()
    }
  }

  function applyPackText(text) {
    var parsed = WorldModel.parsePack(text)
    if (!parsed || !parsed.assets) {
      root.lastError = "starter pack missing"
      root.pack = ({})
      root.packLoaded = false
      return
    }
    root.pack = parsed
    root.packLoaded = true
  }

  function persist() {
    if (!root.persistReady) return
    ensureStateDir()
    worldFile.setText(JSON.stringify(root.world, null, 2) + "\n")
  }

  function replaceWorld(next) {
    if (!next) return
    root.world = next
    persist()
  }

  function setCamera(cam) {
    if (cam !== "inside" && cam !== "yard") return
    var next = WorldModel.deepCopy(root.world)
    next.camera = cam
    // Keep the agent in the view they belong to; moving cameras does not
    // teleport them, but they only render in their own camera.
    replaceWorld(next)
  }

  function setPlaceAsset(assetId) {
    var next = WorldModel.deepCopy(root.world)
    next.placeAssetId = assetId || null
    next.selection = null
    replaceWorld(next)
  }

  function clearSelection() {
    var next = WorldModel.deepCopy(root.world)
    next.selection = null
    next.placeAssetId = null
    replaceWorld(next)
  }

  function walkTo(cellX, cellY) {
    var cam = root.camera
    var agent = root.world.agent || {}
    // Agent only walks in the camera they currently occupy.
    var agentCam = agent.camera || "inside"
    if (agentCam !== cam) return

    var path = WorldModel.pathfind(
      root.world, root.pack, cam,
      Number(agent.x) || 0, Number(agent.y) || 0,
      cellX, cellY)
    root.walkQueue = path
    if (path.length === 0) return
    var next = WorldModel.deepCopy(root.world)
    next.agent.mood = "walk"
    replaceWorld(next)
    root.walking = true
    if (!walkTimer.running) walkTimer.start()
  }

  function stepWalk() {
    if (!root.walkQueue || root.walkQueue.length === 0) {
      root.walking = false
      walkTimer.stop()
      var idle = WorldModel.deepCopy(root.world)
      if (idle.agent) idle.agent.mood = "idle"
      replaceWorld(idle)
      return
    }
    var step = root.walkQueue[0]
    var rest = root.walkQueue.slice(1)
    var next = WorldModel.deepCopy(root.world)
    var from = { x: next.agent.x, y: next.agent.y }
    next.agent.facing = WorldModel.facingFromStep(from, step)
    next.agent.x = step.x
    next.agent.y = step.y
    next.agent.mood = rest.length ? "walk" : "idle"
    root.walkQueue = rest
    replaceWorld(next)
    if (rest.length === 0) {
      root.walking = false
      walkTimer.stop()
    }
  }

  function handleCellClick(cellX, cellY, button) {
    var cam = root.camera
    var placeId = root.world.placeAssetId

    if (button === Qt.RightButton) {
      var hit = WorldModel.objectAt(root.world, cam, cellX, cellY, root.pack)
      if (hit) {
        replaceWorld(WorldModel.removeObject(root.world, hit.id))
      } else {
        clearSelection()
      }
      return
    }

    if (button === Qt.MiddleButton) {
      var pick = WorldModel.objectAt(root.world, cam, cellX, cellY, root.pack)
      if (pick) {
        var next = WorldModel.deepCopy(root.world)
        next.selection = pick.id
        next.placeAssetId = null
        replaceWorld(next)
      }
      return
    }

    // Left click
    if (placeId) {
      var placed = WorldModel.placeObject(root.world, root.pack, cam, placeId, cellX, cellY)
      if (placed) replaceWorld(placed)
      return
    }

    var selected = WorldModel.objectAt(root.world, cam, cellX, cellY, root.pack)
    if (selected && root.world.selection === selected.id) {
      // Second click on selection starts a move: remove and enter place mode
      var moved = WorldModel.removeObject(root.world, selected.id)
      moved.placeAssetId = selected.assetId
      moved.selection = null
      replaceWorld(moved)
      return
    }
    if (selected) {
      var sel = WorldModel.deepCopy(root.world)
      sel.selection = selected.id
      replaceWorld(sel)
      return
    }

    walkTo(cellX, cellY)
  }

  function openPanel() {
    if (root.shell && typeof root.shell.summon === "function")
      root.shell.summon("alexokita.oh-machi", "{}")
  }

  function resetWorld() {
    root.walkQueue = []
    root.walking = false
    walkTimer.stop()
    replaceWorld(WorldModel.defaultWorld())
  }

  Timer {
    id: walkTimer
    interval: 140
    repeat: true
    onTriggered: root.stepWalk()
  }

  Process {
    id: mkdirProc
    command: ["mkdir", "-p", root.stateDir]
  }

  FileView {
    id: packFile
    path: root.packPath
    watchChanges: true
    onFileChanged: packFile.reload()
    onLoaded: root.applyPackText(text())
    onLoadFailed: root.applyPackText("")
    Component.onCompleted: reload()
  }

  FileView {
    id: worldFile
    path: root.worldPath
    watchChanges: true
    onFileChanged: worldFile.reload()
    onLoaded: {
      root.persistReady = true
      root.applyWorldText(text())
    }
    onLoadFailed: {
      // First run: create defaults.
      root.persistReady = true
      root.world = WorldModel.defaultWorld()
      root.worldLoaded = true
      root.ensureStateDir()
      Qt.callLater(function() { root.persist() })
    }
    Component.onCompleted: {
      root.ensureStateDir()
      Qt.callLater(function() { worldFile.reload() })
    }
  }

  // Ambient desktop map — one window per screen. PanelWindow is inlined here
  // (same shape as omarchy.background); a separate DesktopMap.qml type was not
  // receiving Variants' modelData under Quickshell's third-party loader.
  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: desk
      required property var modelData

      readonly property int mapScale: 2
      readonly property int margin: 24
      readonly property int lotW: root.world && root.world.lot ? Number(root.world.lot.w) || 12 : 12
      readonly property int lotH: root.world && root.world.lot ? Number(root.world.lot.h) || 10 : 10
      readonly property int tileSize: root.pack && root.pack.tileSize ? Number(root.pack.tileSize) || 16 : 16
      readonly property int cellPx: tileSize * mapScale
      readonly property var house: WorldModel.houseObject(root.world)
      readonly property var houseFp: WorldModel.assetFootprint(root.pack, "house")

      screen: modelData
      color: "transparent"
      WlrLayershell.namespace: "oh-machi-desktop"
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      exclusionMode: ExclusionMode.Ignore
      exclusiveZone: 0

      anchors { right: true; bottom: true }
      margins { right: desk.margin; bottom: desk.margin }
      implicitWidth: desk.lotW * desk.cellPx
      implicitHeight: desk.lotH * desk.cellPx

      mask: Region { item: houseHit }

      Item {
        anchors.fill: parent

        PixelStack {
          anchors.centerIn: parent
          world: root.world
          pack: root.pack
          packDir: root.packDir
          camera: "yard"
          tileSize: desk.tileSize
          scaleFactor: desk.mapScale
          interactive: false
          showGridHover: false
        }

        Rectangle {
          anchors.fill: parent
          color: "transparent"
          border.color: "#00000055"
          border.width: 2
          z: 50
        }

        Item {
          id: houseHit
          visible: desk.house !== null
          x: desk.house ? desk.house.x * desk.cellPx : 0
          y: desk.house ? desk.house.y * desk.cellPx : 0
          width: (desk.houseFp.w || 3) * desk.cellPx
          height: (desk.houseFp.h || 3) * desk.cellPx
          z: 60

          MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: {
              root.setCamera("inside")
              root.openPanel()
            }
          }
        }
      }
    }
  }
}
