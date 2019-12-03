const flume = require('flumedb')
const obv = require('obv')
const path = require('path')
const pull = require('pull-stream')

let createFakeFilename

try {
  const os = require('os')
  const fs = require('fs')

  createFakeFilename = () => path.join(
    fs.mkdtempSync(path.join(
      os.tmpdir(),
      'ssb-db-')
    ),
    'log.flumeproxy'
  )
} catch (e) {
  // We're probably running in a browser.
  createFakeFilename = () => null
}

module.exports = (remote) => {
  // Create local instance of flumedb that depends on the remote log.
  // Views will be created locally but the log will remain remote.
  const since = obv()

  pull(
    remote.createRawLogStream({ live: true, values: false }),
    pull.drain((value) => {
      since.set(value)
    })
  )

  const proxy = flume({
    stream: (opts, cb) => remote.createLogStream(
      { raw: true, ...opts },
      cb
    ),
    since,
    get: (seq, cb) => remote.get({ id: seq }, cb),
    filename: createFakeFilename()
  })

  const _use = proxy.use

  // Rewrite use() to match _flumeUse() API
  proxy.use = (name, createView) => {
    _use(name, createView)
    return proxy.views[name]
  }

  return proxy
}
