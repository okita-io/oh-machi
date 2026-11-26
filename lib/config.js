import os from 'node:os'
import path from 'node:path'

export function configDir() {
  return process.env.OHMACHI_CONFIG_DIR || path.join(os.homedir(), '.config', 'ohmachi')
}

export function defaultPort() {
  const p = Number(process.env.OHMACHI_PORT)
  return Number.isFinite(p) && p > 0 ? p : 8765
}