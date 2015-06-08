# Whoosh

Whoosh is an ultra thin wrapper for [SFTPStream](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md). It's so thin that there's not much point using it unless you want to stream in memory content to/from an SFTP server.

## Usage

### Connecting
```js
Whoosh.connect({
    hostname: 'sftp.example.com',
    port: 22,
    username: 'fred',
    password: 'secret'
}, function(err, whoosh) {
    // handle error or do stuff with whoosh
})
```
See the [ssh2 client docs](https://github.com/mscdex/ssh2#client-methods) for a full list of connection parameters

### Write the contents of a variable to a remote file
```js
var content = 'my content'
Whoosh.connect(config, function(err, whoosh) {
    if (err) return bail(err)
    whoosh.putContent('some/remote/file.txt', content, options, function(err, stats) {
        whoosh.disconnect(function() {
            if (err) return bail(err)
            console.log('Uploaded ' + stats.size + ' bytes')
        })
    })
})
```

### Read the contents of a remote file into a variable
```js
Whoosh.connect(config, function(err, whoosh) {
    if (err) return bail(err)
    whoosh.putContent('some/remote/file.txt', 'my content', options, function(err, content) {
        whoosh.disconnect(function() {
            if (err) return bail(err)
            console.log('Downloaded ' + Buffer.byteLength(content.length) + ' bytes')
        )}
    })
})
```
### What are my options?
The options parameters are passed straight through to [SFTPStream's](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md) ```createReadStream``` and ```createWriteStream``` methods respectively. You can omit the options parameter entirely if you wish.

### Everything else

The ```whoosh``` object is just a decorated instance of [SFTPStream](https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md) so all the other SFTP methods are available. e.g.
```js
Whoosh.connect(config, function(err, whoosh) {
    if (err) return bail(err)
    whoosh.unlink('some/remote/file.txt', function(err) {
        whoosh.disconnect(function() {
            if (err) return bail(err)
            console.log('Deleted some/remote/file.txt')
        })
    })
})
```



