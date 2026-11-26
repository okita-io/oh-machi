import Bonjour from 'bonjour-service'

/**
 * @param {object} opts
 * @param {number} opts.port HTTP port
 * @param {string} opts.fingerprint town topic fingerprint (not full secret)
 * @param {string} opts.town normalized town name
 */
export function advertiseOhmachi(opts) {
  const bonjour = new Bonjour()
  const name = `ohmachi-${opts.fingerprint}`
  const service = bonjour.publish({
    name,
    type: 'ohmachi',
    protocol: 'udp',
    port: opts.port,
    txt: {
      town: opts.town,
      fp: opts.fingerprint,
      v: '1',
    },
  })
  return {
    stop() {
      service.stop()
      bonjour.destroy()
    },
  }
}