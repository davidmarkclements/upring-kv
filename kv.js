'use strict'

const UpRing = require('upring')
const clone = require('clone')
const nes = require('never-ending-stream')
const commands = require('./lib/commands')
const ns = 'kv'

function UpRingKV (opts) {
  if (!(this instanceof UpRingKV)) {
    return new UpRingKV(opts)
  }

  opts = opts || {}

  this.upring = opts.upring || new UpRing(opts)

  this._ready = false
  this.closed = false

  commands(this)

  // expose the parent logger
  this.logger = this.upring.logger

  this.upring.on('up', () => {
    this._ready = true
  })
}

UpRingKV.prototype.put = function (key, value, cb) {
  if (!this._ready) {
    this.upring.once('up', this.put.bind(this, key, value, cb))
    return
  }

  if (this.upring.allocatedToMe(key)) {
    value = clone(value)
  }

  this.upring.request({ key, value, ns, cmd: 'put' }, cb)
}

UpRingKV.prototype.get = function (key, cb) {
  if (!this._ready) {
    this.upring.once('up', this.get.bind(this, key, cb))
    return
  }

  this.upring.request({ key, ns, cmd: 'get' }, function (err, result) {
    cb(err, result ? result.value : null)
  })
}

UpRingKV.prototype.liveUpdates = function (key) {
  const result = nes.obj((done) => {
    this.upring.request({ key, ns, cmd: 'liveUpdates' }, function (err, res) {
      if (err) {
        done(err)
        return
      }

      result.emit('newStream')

      done(null, res.streams.updates)
    })
  })

  return result
}

UpRingKV.prototype.whoami = function () {
  return this.upring.whoami()
}

UpRingKV.prototype.close = function (cb) {
  cb = cb || noop
  if (!this._ready) {
    this.upring.once('up', this.close.bind(this, cb))
    return
  }

  if (this.closed) {
    cb()
    return
  }

  this.closed = true

  this.upring.close((err) => {
    cb(err)
  })
}

function noop () {}

module.exports = UpRingKV
