var Client = require('ssh2').Client
var debug = require('debug')('whoosh')
var ssh2Debug = require('debug')('whoosh:ssh2')
var _ = require('lodash')
var Readable = require('stream').Readable
var format = require('util').format

module.exports = {
    connect: function(config, next) {

        var connection = new Client()
        var once = _.once(next)
        var remoteUrl = format('%s@%s:%s', config.username, config.hostname, config.port)

        debug('Connecting to server %s:%s', config.hostname, config.port)
        connection.connect(_.defaults(config, { debug: ssh2Debug }))

        connection.on('ready', function() {
            debug('Connected to server %s', remoteUrl)

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

                        readStream.on('data', function(chunk) {
                            content += chunk
                        }).on('end', function() {
                            debug('Downloaded %d bytes', countBytes(content), remoteUrl)
                            once(null, content)
                        }).on('error', once)
                    },
                    putContent: function(content, remotePath, options, next) {
                        if (arguments.length === 3) return sftp.putContent(content, remotePath, {}, arguments[2])

                        var once = _.once(next)
                        var writeStream = sftp.createWriteStream(remotePath)
                        var size = countBytes(content)

                        writeStream.on('close', function() {
                            debug('Uploaded %d bytes to %s', size, remoteUrl)
                            once(null, { size: size })
                        }).on('error', once)

                        var readStream = new Readable()
                        readStream.push(content)
                        readStream.push(null)
                        readStream.pipe(writeStream)
                    },
                    disconnect: function(next) {
                        if (connection._sock.destroyed) return next()
                        sftp.end()
                        connection.end()
                        connection.once('close', next)
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
        })

        connection.on('close', function() {
            debug('Connection to %s:%s closed', config.hostname, config.port)
        })
    }
}

function countBytes(content) {
    return Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content)
}

