var io = require('socket.io-client');


module.exports= exports = PSocket;

/**
 * Shortcut to `Emitter#emit`.
 */

var emit = Emitter.prototype.emit;

function PSocket(uri, opts){
    if (!(this instanceof PSocket)) return new PSocket(uri, opts);

    var self = this;

    if (typeof uri == 'object') {
        opts = uri;
        uri = undefined;
    }
    opts = opts || {};
    opts.streamCnt = opts.streamCnt || 20;
    opts.forceNew = true;

    this.socketList=[];
    this.connected = false;
    this.disconnected = true;


    for(var i=0 ;i <opts.streamCnt; i++){
        var socket = io(uri,opts);
        this.socketList.add(socket);
        socket.on('connect',function(){
            self.onconnect(this);
        }).on('disconnect',function(reason){
            self.ondisconnect(this, reason);
        }).on('error',function(data){
            self.onerror(this, data);
        });
    }
};

/**
 * Mix in `Emitter`.
 */

Emitter(PSocket.prototype);

/**
 * "Opens" the socket.
 *
 * @api public
 */

PSocket.prototype.open=
PSocket.prototype.connect=function(){
    // TODO: need to rewrite the function
    if (this.connected) return this;

    this.subEvents();
    this.io.open(); // ensure open
    if ('open' == this.io.readyState) this.onopen();
    return this;
};

/**
 * Sends a `message` event.
 *
 * @return {Socket} self
 * @api public
 */

PSocket.prototype.send = function(){
    // TODO: need to rewrite the function
    var args = toArray(arguments);
    args.unshift('message');
    this.emit.apply(this, args);
    return this;
};

/**
 * Override `emit`.
 * If the event is in `events`, it's emitted normally.
 *
 * @param {String} event name
 * @return {Socket} self
 * @api public
 */
PSocket.prototype.emit=function(ev){
    // TODO: need to rewrite the function
    if (events.hasOwnProperty(ev)) {
        emit.apply(this, arguments);
        return this;
    }

    var args = toArray(arguments);
    var parserType = parser.EVENT; // default
    if (hasBin(args)) { parserType = parser.BINARY_EVENT; } // binary
    var packet = { type: parserType, data: args };

    // event ack callback
    if ('function' == typeof args[args.length - 1]) {
        debug('emitting packet with ack id %d', this.ids);
        this.acks[this.ids] = args.pop();
        packet.id = this.ids++;
    }

    if (this.connected) {
        this.packet(packet);
    } else {
        this.sendBuffer.push(packet);
    }

    return this;
};


/**
 * Disconnects the socket manually.
 *
 * @return {Socket} self
 * @api public
 */

PSocket.prototype.close =
PSocket.prototype.disconnect = function(){
    // TODO: need to rewrite the function
    if (this.connected) {
        debug('performing disconnect (%s)', this.nsp);
        this.packet({ type: parser.DISCONNECT });
    }

    // remove socket from pool
    this.destroy();

    if (this.connected) {
        // fire events
        this.onclose('io client disconnect');
    }
    return this;
};

/**
 * Called upon socket `connect`.
 *
 * @api private
 */
PSocket.prototype.onconnect=function(socket){
    this.connected = true;
    this.disconnected = false;

    // TODO: need to rewrite the function
    this.emit('connect');
};

/**
 * Called upon socket `close`.
 *
 * @param {Object} socket
 * @param {String} reason
 * @api private
 */
PSocket.prototype.ondisconnect=function(socket, reason){
    this.connected = false;
    this.disconnected = true;
    // TODO: need to rewrite the function
    this.emit('disconnect', reason);
};

PSocket.prototype.onerror=function(socket, err){
    this.emit('error',err);
};