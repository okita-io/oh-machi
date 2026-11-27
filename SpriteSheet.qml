import QtQuick

// Draws one frame from a horizontal sprite sheet, or scales the whole image
// into width x height when frame < 0. Nearest-neighbour friendly (smooth: false).
Item {
  id: root

  property url source
  property int frame: -1
  property int frameW: 16
  property int frameH: 16

  clip: frame >= 0

  Image {
    id: image
    source: root.source
    asynchronous: true
    smooth: false
    mipmap: false
    antialiasing: false

    // Sheet: scale so one frame fills the item, then offset by frame index.
    // Full image: stretch into the allocated box.
    width: root.frame >= 0
      ? (implicitWidth > 0 && root.frameW > 0
          ? (implicitWidth / root.frameW) * root.width
          : root.width)
      : root.width
    height: root.frame >= 0
      ? (implicitHeight > 0 && root.frameH > 0
          ? (implicitHeight / root.frameH) * root.height
          : root.height)
      : root.height

    x: root.frame >= 0 ? -root.frame * root.width : 0
    y: 0
  }
}
