import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "WorldModel.js" as WorldModel

Panel {
  id: root
  moduleName: "alexokita.oh-machi"
  ipcTarget: "alexokita.oh-machi"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var service: null
  readonly property var barIdentity: hostWidget || root

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  readonly property color foreground: bar ? bar.foreground : Commons.Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.45)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property int mapScale: 3
  readonly property int tileSize: service && service.pack && service.pack.tileSize
    ? Number(service.pack.tileSize) || 16 : 16

  function open() { controller.show() }
  function close() { controller.hide() }
  function toggle() { opened ? close() : open() }
  function closeForPopoutSwitch() {
    popoutSwitchClosing = true
    close()
    Qt.callLater(function() { popoutSwitchClosing = false })
  }

  function switchPanel(direction) {
    if (bar && typeof bar.switchPanelFrom === "function")
      return bar.switchPanelFrom(barIdentity, direction)
    return false
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Math.max(Style.space(420), stack.width + Style.space(24)))
    contentHeight: panel.fittedContentHeight(
      header.implicitHeight + stack.height + toolbar.implicitHeight + Style.space(36),
      Style.space(720))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) {
        if (!root.service) return
        if (text === "i" || text === "I") root.service.setCamera("inside")
        else if (text === "y" || text === "Y") root.service.setCamera("yard")
        else if (text === "Escape") root.service.clearSelection()
      }
    }

    Column {
      id: content
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.margins: Style.space(12)
      spacing: Style.space(10)

      RowLayout {
        id: header
        width: parent.width
        spacing: Style.space(8)

        Text {
          textFormat: Text.PlainText
          text: strings.t("panel.title")
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          font.bold: true
          Layout.fillWidth: true
        }

        Text {
          textFormat: Text.PlainText
          text: root.service
            ? (root.service.agentName + " · " + root.service.agentMood)
            : ""
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }
      }

      Item {
        id: stage
        width: stack.width
        height: stack.height
        anchors.horizontalCenter: parent.horizontalCenter

        PixelStack {
          id: stack
          world: root.service ? root.service.world : ({})
          pack: root.service ? root.service.pack : ({})
          packDir: root.service ? root.service.packDir : ""
          camera: root.service ? root.service.camera : "inside"
          tileSize: root.tileSize
          scaleFactor: root.mapScale
          interactive: true

          onCellClicked: function(cellX, cellY, button) {
            if (root.service) root.service.handleCellClick(cellX, cellY, button)
          }
          onHouseClicked: {
            if (root.service) root.service.setCamera("inside")
          }
        }
      }

      Column {
        id: toolbar
        width: parent.width
        spacing: Style.space(8)

        RowLayout {
          width: parent.width
          spacing: Style.space(6)

          Button {
            text: strings.t("panel.inside")
            selected: root.service && root.service.camera === "inside"
            bordered: true
            onClicked: if (root.service) root.service.setCamera("inside")
          }
          Button {
            text: strings.t("panel.yard")
            selected: root.service && root.service.camera === "yard"
            bordered: true
            onClicked: if (root.service) root.service.setCamera("yard")
          }
          Item { Layout.fillWidth: true }
          Button {
            text: strings.t("panel.reset")
            bordered: true
            onClicked: if (root.service) root.service.resetWorld()
          }
        }

        Text {
          textFormat: Text.PlainText
          width: parent.width
          wrapMode: Text.WordWrap
          text: strings.t("panel.help")
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Text {
          textFormat: Text.PlainText
          text: strings.t("panel.place")
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Flow {
          width: parent.width
          spacing: Style.space(6)

          Repeater {
            model: root.service ? root.service.placeables : []

            delegate: Button {
              required property var modelData
              text: modelData
              selected: root.service && root.service.world
                && root.service.world.placeAssetId === modelData
              bordered: true
              onClicked: {
                if (!root.service) return
                if (root.service.world && root.service.world.placeAssetId === modelData)
                  root.service.setPlaceAsset(null)
                else
                  root.service.setPlaceAsset(modelData)
              }
            }
          }
        }
      }
    }
  }
}
