const assert = require('assert');
const { match, ok, ifError, strictEqual: eq } = require('assert');
const _ = require('lodash');
const async = require('async');
const fs = require('fs-extra');
const crypto = require('crypto');
const Whoosh = require('..');

describe('client', () => {
  beforeEach(nuke);

  after(nuke);

  function nuke(next) {
    async.series([fs.remove.bind(fs, getLocalPath()), fs.mkdirp.bind(fs, getLocalPath()), fs.chmod.bind(fs, getLocalPath(), '0777')], next);
  }

  const config = {
    hostname: 'localhost',
    port: 10022,
    username: 'fred',
    password: 'password',
  };

  it('should report connection errors', (t, done) => {
    Whoosh.connect(_.defaults({ hostname: 'this-server-should-not-resolve-12asdf32' }, config), (err, whoosh) => {
      ok(err, 'Connection error was not reported');
      match(err.message, /getaddrinfo (?:ENOTFOUND|EAI_AGAIN)/);
      done();
    });
  });

  it('should report connection errors', (t, done) => {
    Whoosh.connect(_.defaults({ password: 'bad' }, config), (err, whoosh) => {
      ok(err, 'Connection error was not reported');
      eq(err.message, 'All configured authentication methods failed');
      done();
    });
  });

  it('should connect successfully', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.stat('.', (err, stats) => {
        ifError(err);
        ok(stats);
        whoosh.disconnect(done);
      });
    });
  });

  it('should upload text content', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.putContent('test message', getRemotePath(t.name), (err, stats) => {
        ifError(err);
        eq('test message', fs.readFileSync(getLocalPath(t.name)).toString());
        eq(stats.bytes, 12);
        ok(stats.duration > 0);
        whoosh.disconnect(done);
      });
    });
  });

  it('should download text content', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      fs.writeFileSync(getLocalPath(t.name), 'test message');
      whoosh.getContent(getRemotePath(t.name), (err, content, stats) => {
        ifError(err);
        eq('test message', content);
        eq(stats.bytes, 12);
        ok(stats.duration > 0);
        whoosh.disconnect(done);
      });
    });
  });

  it('should upload binary content', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.putContent(Buffer.from('test message'), getRemotePath(t.name), (err, stats) => {
        ifError(err);
        eq('test message', fs.readFileSync(getLocalPath(t.name)).toString());
        eq(stats.bytes, 12);
        whoosh.disconnect(done);
      });
    });
  });

  it('should download binary content', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      fs.writeFileSync(getLocalPath(t.name), Buffer.from('test message'));
      whoosh.getContent(getRemotePath(t.name), (err, content) => {
        ifError(err);
        eq('test message', content);
        whoosh.disconnect(done);
      });
    });
  });

  it('should support multiple serial operations', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      async.series(
        {
          a: whoosh.putContent.bind(whoosh, 'test message 1', getRemotePath(t.name + '_1')),
          b: whoosh.putContent.bind(whoosh, 'test message 2', getRemotePath(t.name + '_2')),
          c: whoosh.putContent.bind(whoosh, 'test message 3', getRemotePath(t.name + '_3')),
          list: whoosh.readdir.bind(whoosh, getRemotePath()),
        },
        (err, results) => {
          ifError(err);
          eq(results.list.length, 3);
          whoosh.disconnect(done);
        }
      );
    });
  });

  it('should upload large files', (t, done) => {
    const content = crypto.pseudoRandomBytes(1024 * 1024).toString('hex');

    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.putContent(content, getRemotePath(t.name), (err) => {
        ifError(err);
        eq(content, fs.readFileSync(getLocalPath(t.name)).toString());
        whoosh.disconnect(done);
      });
    });
  });

  it(
    'should upload a lot of files',
    (t, done) => {
      const content = crypto.pseudoRandomBytes(1024).toString('hex');

      Whoosh.connect(config, (err, whoosh) => {
        ifError(err);
        async.timesLimit(
          1000,
          50,
          (index, next) => {
            whoosh.putContent(content, getRemotePath(t.name + '_' + index), next);
          },
          (err) => {
            ifError(err);
            whoosh.readdir(getRemotePath(), (err, list) => {
              ifError(err);
              eq(list.length, 1000);
              ok(
                !_.find(list, (stat) => {
                  return stat.attrs.size !== content.length;
                }),
                'File was corrupted during upload'
              );
              whoosh.disconnect(done);
            });
          }
        );
      });
    },
    { timeout: 20000 }
  );

  it('should tolerate repeated disconnects', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      async.times(
        10,
        (index, next) => {
          whoosh.disconnect(next);
        },
        done
      );
    });
  });

  it('should report connection state (sync)', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      ok(whoosh.isConnected());
      whoosh.disconnect(function () {
        ok(!whoosh.isConnected());
        done();
      });
    });
  });

  it('should report connection state (async)', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      async.series(
        {
          shouldBeConnected: whoosh.isConnected,
          meh: whoosh.disconnect,
          shouldBeDisconnected: whoosh.isConnected,
        },
        (err, results) => {
          ifError(err);
          ok(results.shouldBeConnected);
          ok(!results.shouldBeDisconnected);
          done();
        }
      );
    });
  });

  it('should report if a file exists', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.putContent('test message', getRemotePath(t.name), (err, stats) => {
        ifError(err);
        whoosh.exists(getRemotePath(t.name), (err, exists) => {
          ifError(err);
          eq(exists, true);
          whoosh.disconnect(done);
        });
      });
    });
  });

  it('should report if a file does not exist', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.exists(getRemotePath(t.name), (err, exists) => {
        ifError(err);
        eq(exists, false);
        whoosh.disconnect(done);
      });
    });
  });

  it('should not disconnect after checking if a non existent file exists', (t, done) => {
    Whoosh.connect(config, (err, whoosh) => {
      ifError(err);
      whoosh.exists(getRemotePath(t.name), (err, exists) => {
        ifError(err);
        ok(whoosh.isConnected());
        whoosh.disconnect(done);
      });
    });
  });

  function getRemotePath(filename) {
    return 'files/uploads/' + (filename ? filename.replace(/\W/g, '_') : '');
  }

  function getLocalPath(filename) {
    return __dirname + '/volumes/sftp/home/fred/' + getRemotePath(filename);
  }
});
