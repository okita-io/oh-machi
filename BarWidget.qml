import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "WorldModel.js" as WorldModel

BarWidget {
  id: root
  moduleName: "alexokita.oh-machi"

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  readonly property var town: bar && bar.shell
    ? bar.shell.serviceFor(root.moduleName) : null
  readonly property bool ready: town !== null && town.packLoaded
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true : false

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  function open() { if (panelLoader.item) panelLoader.item.open() }
  function close() { if (panelLoader.item) panelLoader.item.close() }
  function togglePanel() { if (panelLoader.item) panelLoader.item.toggle() }
  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("service" in target) target.service = root.town
  }

  onBarChanged: injectPanel()
  onTownChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: root.moduleName

    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    function inside(): void { if (root.town) root.town.setCamera("inside") }
    function yard(): void { if (root.town) root.town.setCamera("yard") }
    function reset(): void { if (root.town) root.town.resetWorld() }
    function status(): string {
      if (!root.ready) return "service unavailable"
      return "camera=" + root.town.camera
        + " agent=" + root.town.agentName
        + " mood=" + root.town.agentMood
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: !root.ready
      ? "🏠…"
      : ("🏠 " + WorldModel.moodGlyph(root.town.agentMood))
    dimmed: !root.ready
    active: root.opened || (root.ready && root.town.walking)
    tooltipText: !root.ready
      ? strings.t("bar.loading")
      : strings.t("bar.tooltip").arg(root.town.agentName).arg(root.town.agentMood)
    onPressed: function(code) {
      if (code === Qt.MiddleButton && root.town) root.town.setCamera(
        root.town.camera === "inside" ? "yard" : "inside")
      else root.togglePanel()
    }
  }
}
