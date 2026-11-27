import QtQuick
import Quickshell
import Quickshell.Wayland
import "WorldModel.js" as WorldModel

// Reference implementation of the ambient lot. The live service inlines a
// PanelWindow (Quickshell Variants + third-party plugin types were unreliable
// with this as a separate root). Kept for docs and for a future extract.
PanelWindow {
  id: window

  property var service: null
  property var targetScreen: null

  readonly property int mapScale: 2
  readonly property int margin: 24
  readonly property int lotW: service && service.world && service.world.lot
    ? Number(service.world.lot.w) || 12 : 12
  readonly property int lotH: service && service.world && service.world.lot
    ? Number(service.world.lot.h) || 10 : 10
  readonly property int tileSize: service && service.pack && service.pack.tileSize
    ? Number(service.pack.tileSize) || 16 : 16
  readonly property int cellPx: tileSize * mapScale
  readonly property var house: service && service.world
    ? WorldModel.houseObject(service.world) : null
  readonly property var houseFp: service && service.pack
    ? WorldModel.assetFootprint(service.pack, "house")
    : ({ w: 3, h: 3, anchorY: 2 })

  screen: targetScreen
  color: "transparent"
  WlrLayershell.namespace: "oh-machi-desktop-ref"
  WlrLayershell.layer: WlrLayer.Bottom
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
  exclusionMode: ExclusionMode.Ignore
  exclusiveZone: 0

  anchors { right: true; bottom: true }
  margins { right: window.margin; bottom: window.margin }
  implicitWidth: lotW * cellPx
  implicitHeight: lotH * cellPx
  visible: false

  PixelStack {
    anchors.centerIn: parent
    world: window.service ? window.service.world : ({})
    pack: window.service ? window.service.pack : ({})
    packDir: window.service ? window.service.packDir : ""
    camera: "yard"
    tileSize: window.tileSize
    scaleFactor: window.mapScale
    interactive: false
  }
}
