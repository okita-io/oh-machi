import QtQuick
import "WorldModel.js" as WorldModel
// SpriteSheet.qml is a sibling type in this plugin directory.

Item {
  id: root

  property var world: ({})
  property var pack: ({})
  property string packDir: ""
  property string camera: "inside"
  property int tileSize: 16
  property int scaleFactor: 3
  property bool interactive: true
  property bool showGridHover: true

  signal cellClicked(int cellX, int cellY, int button)
  signal houseClicked()

  readonly property int lotW: world && world.lot ? Number(world.lot.w) || 12 : 12
  readonly property int lotH: world && world.lot ? Number(world.lot.h) || 10 : 10
  readonly property int cellPx: tileSize * scaleFactor
  readonly property var drawList: {
    if (!world || !pack || !pack.assets) return []
    return WorldModel.buildDrawList(world, pack, camera, scaleFactor, tileSize)
  }

  property int hoverX: -1
  property int hoverY: -1

  width: lotW * cellPx
  height: lotH * cellPx
  clip: true

  function assetUrl(fileName) {
    if (!packDir || !fileName) return ""
    var base = packDir
    if (base.charAt(base.length - 1) !== "/") base += "/"
    if (base.indexOf("file:") === 0 || base.indexOf("qrc:") === 0)
      return base + fileName
    return "file://" + base + fileName
  }

  function cellFromPos(px, py) {
    return {
      x: Math.floor(px / cellPx),
      y: Math.floor(py / cellPx)
    }
  }

  Rectangle {
    anchors.fill: parent
    color: root.camera === "yard" ? "#4a7a3a" : "#3a2a1a"
  }

  Repeater {
    model: root.drawList

    delegate: SpriteSheet {
      required property var modelData
      x: modelData.x
      y: modelData.y
      z: 1
      width: modelData.w
      height: modelData.h
      source: root.assetUrl(modelData.file)
      frame: modelData.frame
      frameW: modelData.frameW > 0 ? modelData.frameW : root.tileSize
      frameH: modelData.frameH > 0 ? modelData.frameH : root.tileSize
    }
  }

  // Hover cursor for placement / walk preview
  Rectangle {
    visible: root.interactive && root.showGridHover && root.hoverX >= 0
    x: root.hoverX * root.cellPx
    y: root.hoverY * root.cellPx
    width: root.cellPx
    height: root.cellPx
    color: "transparent"
    border.color: "#ffdc50"
    border.width: 2
    z: 100
    opacity: 0.85
  }

  MouseArea {
    id: mouse
    anchors.fill: parent
    enabled: root.interactive
    hoverEnabled: true
    acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton

    onPositionChanged: function(mouse) {
      var c = root.cellFromPos(mouse.x, mouse.y)
      root.hoverX = c.x
      root.hoverY = c.y
    }
    onExited: {
      root.hoverX = -1
      root.hoverY = -1
    }
    onClicked: function(mouse) {
      var c = root.cellFromPos(mouse.x, mouse.y)
      // House hit on yard camera: any click on the house footprint opens the panel
      // from the desktop map; inside the panel we still emit cellClicked.
      if (root.camera === "yard") {
        var house = WorldModel.houseObject(root.world)
        if (house) {
          var fp = WorldModel.assetFootprint(root.pack, "house")
          if (c.x >= house.x && c.x < house.x + fp.w && c.y >= house.y && c.y < house.y + fp.h) {
            root.houseClicked()
          }
        }
      }
      root.cellClicked(c.x, c.y, mouse.button)
    }
  }
}
