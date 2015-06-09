var Client = require('ssh2').Client
var debug = require('debug')('whoosh:client')
var ssh2Debug = require('debug')('whoosh:ssh2')
var _ = require('lodash')
var Readable = require('stream').Readable
var format = require('util').format

module.exports = {
    connect: function(config, next) {

        var connection = new Client()
        var once = _.once(next)
        var remoteUrl = format('%s@%s:%s', config.username, config.hostname, config.port)
        var disconnected = true
        var disconnecting = false

        debug('Connecting to server %s:%s', config.hostname, config.port)
        connection.connect(_.defaults(config, { debug: ssh2Debug }))

        connection.on('ready', function() {
            debug('Connected to server %s', remoteUrl)
            disconnected = false

            connection.sftp(function(err, sftp) {

                if (err) {
                    connection.end()
                    return next(err)
                }

                sftp = _.extend(sftp, {
                    getContent: function(remotePath, options, next) {
                        if (arguments.length === 2) return sftp.getContent(remotePath, {}, arguments[1])

                        var once = _.once(next)
                        var content = ''
                        var readStream = sftp.createReadStream(remotePath, options)
                        var before = new Date().getTime()

                        readStream.on('data', function(chunk) {
                            content += chunk
                        }).on('end', function() {
                            var duration = new Date().getTime() - before
                            var size = countBytes(content)
                            debug('Downloaded %d bytes from %s in %dms', size, remoteUrl, duration)
                            once(null, content, { size: size, duration: duration })
                        }).on('error', once)
                    },
                    putContent: function(content, remotePath, options, next) {
                        if (arguments.length === 3) return sftp.putContent(content, remotePath, {}, arguments[2])

                        var once = _.once(next)
                        var writeStream = sftp.createWriteStream(remotePath)
                        var before = new Date().getTime()

                        writeStream.on('close', function() {
                            var duration = new Date().getTime() - before
                            var size = countBytes(content)
                            debug('Uploaded %d bytes to %s in %sms', size, remoteUrl, duration)
                            once(null, { size: size, duration: duration })
                        }).on('error', once)

                        var readStream = new Readable()
                        readStream.push(content)
                        readStream.push(null)
                        readStream.pipe(writeStream)
                    },
                    disconnect: function(next) {
                        if (!sftp.isConnected()) return next()
                        disconnecting = true
                        sftp.end()
                        connection.end()
                        connection.once('close', next)
                    },
                    isConnected: function(next) {
                        var connected = !disconnected && !disconnecting
                        return next && next(null, connected) || connected
                    }
                })

                once(null, sftp)
            })
        })

        connection.on('error', function(err) {
            debug('Received error from connection: %s:%s. Original error was: ', config.hostname, config.port, err.message)
            once(err)
        })

        connection.on('end', function() {
            debug('Connection to %s:%s ended', config.hostname, config.port)
            disconnected = true
            disconnecting = false
        })

        connection.on('close', function() {
            debug('Connection to %s:%s closed', config.hostname, config.port)
            disconnected = true
            disconnecting = false
        })
    }
}

function countBytes(content) {
    return Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content)
}

