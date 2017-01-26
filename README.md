# Whoosh
Whoosh is an ultra thin wrapper for [SFTPStream](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md), with the additional benefit of being able to easily stream in memory content to/from an SFTP server.

[![NPM version](https://img.shields.io/npm/v/whoosh.svg?style=flat-square)](https://www.npmjs.com/package/whoosh)
[![NPM downloads](https://img.shields.io/npm/dm/whoosh.svg?style=flat-square)](https://www.npmjs.com/package/whoosh)
[![Build Status](https://img.shields.io/travis/guidesmiths/whoosh/master.svg)](https://travis-ci.org/guidesmiths/whoosh)
[![Code Climate](https://codeclimate.com/github/guidesmiths/whoosh/badges/gpa.svg)](https://codeclimate.com/github/guidesmiths/whoosh)
[![Test Coverage](https://codeclimate.com/github/guidesmiths/whoosh/badges/coverage.svg)](https://codeclimate.com/github/guidesmiths/whoosh/coverage)
[![Code Style](https://img.shields.io/badge/code%20style-imperative-brightgreen.svg)](https://github.com/guidesmiths/eslint-config-imperative)
[![Dependency Status](https://david-dm.org/guidesmiths/whoosh.svg)](https://david-dm.org/guidesmiths/whoosh)
[![devDependencies Status](https://david-dm.org/guidesmiths/whoosh/dev-status.svg)](https://david-dm.org/guidesmiths/whoosh?type=dev)

## API

### connect(&lt;params&gt;, &lt;cb&gt;)
Connect to an sftp server
```js
Whoosh.connect({
    hostname: 'sftp.example.com',
    port: 22,
    username: 'fred',
    password: 'secret'
}, (err, client) => {
    // profit :)
})
```
See the [ssh2 client docs](https://github.com/mscdex/ssh2#client-methods) for a full list of connection parameters

### disconnect(&lt;cb&gt;)
Disconnect from an sftp server
```
Whoosh.connect(config, (err, client) => {
    client.disconnect(() => {
        // Disconnected
    })
})
```

### isConnected()
Returns true when connected to the SFTP server. Useful for checking whether a previously established connection has dropped.
```js
Whoosh.connect(config, (err, client) => {
    if (err) throw err
    client.isConnected() // returns true
})
```

### isConnected(&lt;cb&gt;)
Asynchronous version of isConnected
```js
Whoosh.connect(config, (err, client) => {
    if (err) throw err
    client.isConnected((err, connected) => {
        // Check connected status here
    )}
})
```

### getContent(&lt;path&gt;, [&lt;options&gt;], &lt;cb&gt;)
Streams the contents of a remote file to a variable
```js
Whoosh.connect(config, (err, client) => {
    if (err) throw err
    client.getContent('some/remote/file', (err, content, stats) => {
        client.disconnect(() => {
            if (err) throw err
            console.log(`Downloaded ${stats.bytes} bytes in ${stats.duration} ms`)
        )}
    })
})
```
The options parameter is is optional. When specified it is passed straight through to [SFTPStream's](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md) ```createReadStream``` method.

### putContent(&lt;content;&gt;, &lt;path&gt;, [&lt;options&gt;], &lt;cb&gt;)
Streams the contents of a variable to a remote file
```js
Whoosh.connect(config, (err, client) => {
    if (err) throw err
    client.putContent('some conent', 'some/remote/file', (err, stats) => {
        client.disconnect(() => {
            if (err) throw err
            console.log(`Uploaded ${stats.bytes} bytes in ${stats.duration} ms`)
        })
    })
})
```
The options parameter is is optional. When specified it is passed straight through to [SFTPStream's](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md) ```createWriteStream``` method.

### exists
Reports on whether a remote file exists
```js
Whoosh.connect(config, function(err, client) {
    if (err) throw err
    client.exists('some/remote/file', (err, exists) => {
        client.disconnect(() => {
            if (err) throw err
            console.log(exists ? 'File exists' : 'File does not exist')
        )}
    })
})
```

## Everything else

The ```client``` object is just a decorated instance of [SFTPStream](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md) so all the other SFTP methods are available. e.g.
```js
Whoosh.connect(config, function(err, client) {
    if (err) throw err
    client.unlink('some/remote/file', function(err) {
        client.disconnect(() => {
            if (err) throw err
            console.log('Deleted some/remote/file')
        })
    })
})
```



