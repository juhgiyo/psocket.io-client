# psocket.io-client

[![Build Status](https://secure.travis-ci.org/juhgiyo/psocket.io-client.svg)](http://travis-ci.org/juhgiyo/psocket.io-client)
![NPM version](https://badge.fury.io/js/psocket.io-client.svg)
![Downloads](http://img.shields.io/npm/dm/psocket.io-client.svg?style=flat)
[![](http://slack.psocket.io/badge.svg)](http://slack.psocket.io)

In Development
=============

## How to use

A standalone build of `psocket.io-client` is exposed automatically by the
socket.io server as `/psocket.io/psocket.io.js`. Alternatively you can
serve the file `psocket.io.js` found at the root of this repository.

```html
<script src="/psocket.io/psocket.io.js"></script>
<script>
  var socket = pio('http://localhost');
  socket.on('connect', function(){});
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
</script>
```

PSocket.IO is compatible with [browserify](http://browserify.org/).

### Node.JS (server-side usage)

  Add `psocket.io-client` to your `package.json` and then:

  ```js
  var socket = require('psocket.io-client')('http://localhost');
  socket.on('connect', function(){});
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
  ```

## API

### PIO(url:String, opts:Object):PSocket

  Exposed as the `pio` namespace in the standalone build, or the result
  of calling `require('psocket.io-client')`.

  When called, it creates a new `Manager` for the given URL, and attempts
  to reuse an existing `Manager` for subsequent calls, unless the
  `multiplex` option is passed with `false`.

  The rest of the options are passed to the `Manager` constructor (see below
  for details).

  A `PSocket` instance is returned for the namespace specified by the
  pathname in the URL, defaulting to `/`. For example, if the `url` is
  `http://localhost/users`, a transport connection will be established to
  `http://localhost` and a Socket.IO connection will be established to
  `/users`.

### PIO#protocol

  Socket.io protocol revision number this client works with.

### PIO#PSocket

  Reference to the `PSocket` constructor.

### IO#Emitter

  Reference to the `Emitter` constructor.

### Manager(url:String, opts:Object)

  A `Manager` represents a connection to a given Socket.IO server. One or
  more `Socket` instances are associated with the manager. The manager
  can be accessed through the `io` property of each `Socket` instance.

  The `opts` are also passed to `engine.io` upon initialization of the
  underlying `Socket`.

  Options:
  - `maxSocketCnt` maximum amount of socket underlying in PSocket
  - `sequentialRecv` whether receive in sequential order (`true`)
  - `reconnection` whether to reconnect automatically (`true`)
  - `reconnectionAttempts` (`Infinity`) before giving up
  - `reconnectionDelay` how long to initially wait before attempting a new
    reconnection (`1000`). Affected by +/- `randomizationFactor`,
    for example the default initial delay will be between 500 to 1500ms.
  - `reconnectionDelayMax` maximum amount of time to wait between
    reconnections (`5000`). Each attempt increases the reconnection delay by 2x
    along with a randomization as above
  - `randomizationFactor(`0.5`), 0 <= randomizationFactor <= 1
  - `timeout` connection timeout before a `connect_error`
    and `connect_timeout` events are emitted (`20000`)
  - `autoConnect` by setting this false, you have to call `manager.open`
    whenever you decide it's appropriate

#### Events

  - `connect_error`. Fired upon a connection error.
    Parameters:
      - `Object` error object
  - `ping`. Fired when a ping packet is written out to the server.
  - `pong`. Fired when a pong is received from the server.
    Parameters:
      - `Number` number of ms elapsed since `ping` packet (i.e.: latency).

The events above are also emitted on the individual sockets that
reconnect that depend on this `Manager`.

### Manager#reconnection(v:Boolean):Manager

  Sets the `reconnection` option, or returns it if no parameters
  are passed.

### Manager#reconnectionAttempts(v:Boolean):Manager

  Sets the `reconnectionAttempts` option, or returns it if no parameters
  are passed.

### Manager#reconnectionDelay(v:Boolean):Manager

  Sets the `reconectionDelay` option, or returns it if no parameters
  are passed.

### Manager#reconnectionDelayMax(v:Boolean):Manager

  Sets the `reconectionDelayMax` option, or returns it if no parameters
  are passed.

### Manager#timeout(v:Boolean):Manager

  Sets the `timeout` option, or returns it if no parameters
  are passed.

### PSocket

#### PSocket#id:String

The property is present once the socket has connected, is removed when the socket disconnects and is updated if the socket reconnects.

#### PSocket#compress(v:Boolean):PSocket

  Sets a modifier for a subsequent event emission that the event data will
  only be _compressed_ if the value is `true`. Defaults to `true` when you don't call the method.

  ```js
  socket.compress(false).emit('an event', { some: 'data' });
  ```

#### Events

  - `connect`. Fired upon a connection including a successful reconnection.
  - `error`. Fired upon a connection error
    Parameters:
      - `Object` error data
  - `disconnect`. Fired upon a disconnection.

## License

[MIT](/LICENSE)
