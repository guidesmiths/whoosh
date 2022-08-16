const Client = require('ssh2').Client;
const debug = require('debug')('whoosh:client');
const ssh2Debug = require('debug')('whoosh:ssh2');
const _ = require('lodash');
const Readable = require('stream').Readable;
const format = require('util').format;

module.exports = {
  connect: function (config, next) {
    const connection = new Client();
    const once = _.once(next);
    const connectionUrl = format('%s@%s:%s', config.username, config.hostname, config.port);
    let disconnected = true;
    let disconnecting = false;

    debug('Connecting to server %s', connectionUrl);
    connection.connect(_.defaults(config, { debug: ssh2Debug }));

    connection.on('ready', () => {
      debug('Connected to server %s', connectionUrl);
      disconnected = false;

      connection.sftp((err, sftp) => {
        if (err) {
          connection.end();
          return next(err);
        }

        sftp = _.extend(sftp, {
          getContent: function (remotePath, options, next) {
            if (arguments.length === 2) return sftp.getContent(remotePath, {}, arguments[1]);

            const once = _.once(next);
            let content = '';

            debug('Creating read stream to %s/%s', connectionUrl, remotePath);
            const readStream = sftp.createReadStream(remotePath, options);
            const before = Date.now();

            readStream
              .on('data', (chunk) => {
                content += chunk;
              })
              .on('end', () => {
                const duration = Date.now() - before;
                const bytes = countBytes(content);

                debug('Downloaded %d bytes from %s/%s in %dms', bytes, connectionUrl, remotePath, duration);
                once(null, content, { bytes: bytes, duration: duration });
              })
              .on('error', once);
          },
          putContent: function (content, remotePath, options, next) {
            if (arguments.length === 3) return sftp.putContent(content, remotePath, {}, arguments[2]);

            const once = _.once(next);

            debug('Creating write stream to %s/%s', connectionUrl, remotePath);
            const writeStream = sftp.createWriteStream(remotePath, options);
            const before = Date.now();

            writeStream
              .on('close', () => {
                const duration = Date.now() - before;
                const bytes = countBytes(content);

                debug('Uploaded %d bytes to %s/%s in %sms', bytes, connectionUrl, remotePath, duration);
                once(null, { bytes: bytes, duration: duration });
              })
              .on('error', once);

            const readStream = new Readable();
            readStream.push(content);
            readStream.push(null);
            readStream.pipe(writeStream);
          },
          exists: function (remotePath, next) {
            sftp.stat(remotePath, (err, stat) => {
              if (err && err.code !== 2) return next(err);
              return next(null, !!stat);
            });
          },
          disconnect: function (next = _.noop) {
            if (!sftp.isConnected()) return next();
            disconnecting = true;
            sftp.end();
            connection.end();
            connection.once('close', next);
          },
          isConnected: function (next) {
            const connected = !disconnected && !disconnecting;
            return (next && next(null, connected)) || connected;
          },
        });

        once(null, sftp);
      });
    });

    connection.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      const responses = _.map(prompts, (entry) => {
        const challenge = _.find(config.challenges, (challenge) => {
          return challenge.pattern.test(entry.prompt);
        });
        if (challenge) return challenge.response;
        debug('No response for challenge: %s', entry.prompt);
        return '';
      });
      finish(responses);
    });

    connection.on('error', (err) => {
      debug('Received error from connection: %s:%s. Original error was: ', config.hostname, config.port, err.message);
      once(err);
    });

    connection.on('end', () => {
      debug('Connection to %s:%s ended', config.hostname, config.port);
      disconnect();
    });

    connection.on('close', () => {
      debug('Connection to %s:%s closed', config.hostname, config.port);
      disconnect();
    });

    function disconnect() {
      disconnected = true;
      disconnecting = false;
    }
  },
};

function countBytes(content) {
  return Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
}
