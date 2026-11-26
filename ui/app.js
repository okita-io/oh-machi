const canvas = document.getElementById('view')
const ctx = canvas.getContext('2d')
const statusEl = document.getElementById('status')
const peersEl = document.getElementById('peers')
const chatEl = document.getElementById('chat')
const townEl = document.getElementById('town')
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')

const TILE = 24
const GRID_W = 32
const GRID_H = 24

let selfKey = ''
let local = { x: 8, y: 8, z: 0, facing_deg: 0 }
/** @type {Record<string, any>} */
let players = {}

const ws = new WebSocket(`ws://${location.host}/ws`)

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.type === 'welcome' || msg.type === 'state') applyState(msg)
})

function applyState(msg) {
  selfKey = msg.self || selfKey
  townEl.textContent = msg.town || ''
  players = msg.players || {}
  statusEl.textContent = `swarm: ${msg.swarmPeers ?? 0} socket(s) · verified: ${(msg.verifiedPeers || []).length}`
  peersEl.replaceChildren(
    ...(msg.verifiedPeers || []).map((pk) => {
      const li = document.createElement('li')
      li.textContent = pk.slice(0, 12) + '…' + (pk === selfKey ? ' (you)' : '')
      return li
    })
  )
  chatEl.replaceChildren(
    ...(msg.chat || []).slice(-30).map((line) => {
      const div = document.createElement('div')
      div.textContent = `${line.author.slice(0, 8)}: ${line.text}`
      return div
    })
  )
  if (selfKey && players[selfKey]?.position) {
    const p = players[selfKey].position
    local = { x: p.x, y: p.y, z: p.z ?? 0, facing_deg: players[selfKey].facing_deg ?? 0 }
  }
  draw()
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = chatInput.value
  chatInput.value = ''
  if (text && ws.readyState === 1) ws.send(JSON.stringify({ type: 'chat', text }))
})

function sendMove() {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'move', ...local }))
  }
}

const keys = new Set()
window.addEventListener('keydown', (e) => {
  if (e.target !== canvas && e.target !== document.body) return
  keys.add(e.key)
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    local.facing_deg = (local.facing_deg + (e.key === 'ArrowLeft' ? -15 : 15) + 360) % 360
    sendMove()
  }
})
window.addEventListener('keyup', (e) => keys.delete(e.key))

function tick() {
  let dx = 0
  let dy = 0
  if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) dy -= 0.08
  if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) dy += 0.08
  if (keys.has('a') || keys.has('A')) dx -= 0.08
  if (keys.has('d') || keys.has('D')) dx += 0.08
  if (dx || dy) {
    local.x = Math.max(0, Math.min(GRID_W - 1, local.x + dx))
    local.y = Math.max(0, Math.min(GRID_H - 1, local.y + dy))
    sendMove()
  }
  draw()
  requestAnimationFrame(tick)
}

function draw() {
  ctx.fillStyle = '#3a5a48'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#2a4038'
  for (let x = 0; x <= GRID_W; x++) {
    ctx.beginPath()
    ctx.moveTo(x * TILE, 0)
    ctx.lineTo(x * TILE, GRID_H * TILE)
    ctx.stroke()
  }
  for (let y = 0; y <= GRID_H; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * TILE)
    ctx.lineTo(GRID_W * TILE, y * TILE)
    ctx.stroke()
  }

  const list = Object.entries(players)
    .map(([id, p]) => ({
      id,
      foot_y: p.position?.y ?? 0,
      foot_x: p.position?.x ?? 0,
      p,
    }))
    .sort((a, b) => a.foot_y - b.foot_y || a.foot_x - b.foot_x)

  for (const entry of list) {
    const { position, facing_deg } = entry.p
    const x = (position?.x ?? 0) * TILE + TILE / 2
    const y = (position?.y ?? 0) * TILE + TILE / 2
    const isSelf = entry.id === selfKey
    ctx.fillStyle = isSelf ? '#ffcc44' : '#66aaff'
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()
    const rad = ((facing_deg ?? 0) * Math.PI) / 180
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(rad) * 14, y + Math.sin(rad) * 14)
    ctx.stroke()
  }
}

requestAnimationFrame(tick)