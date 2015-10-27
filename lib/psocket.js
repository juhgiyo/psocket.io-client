var io = require('socket.io-client');
var Queue = require('queue');
var Emitter = require('component-emitter');

module.exports= exports = PSocket;

/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 *
 * @api private
 */

var events = {
    connect: 1,
    connect_error: 1,
    connect_timeout: 1,
    disconnect: 1,
    error: 1,
    reconnect: 1,
    reconnect_attempt: 1,
    reconnect_failed: 1,
    reconnect_error: 1,
    reconnecting: 1
};

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
    this.pendingSocketQueue=new Queue();
    this.connected = false;
    this.disconnected = true;
    this.socketCnt = opts.streamCnt;
    this.curSocketCnt = 0;
    this.curConnectionTry=0;
    this.reconnection = (opts.reconnection !== false);


    for(var i=0 ;i <opts.streamCnt; i++){
        var socket = io(uri,opts);
        this.socketList.add(socket);
        socket.on('connect',function(){
            self.onconnect(this);
        }).on('connect_error',function() {

        }).on('connect_timeout',function() {

        }).on('disconnect',function(reason){
            self.ondisconnect(this, reason);
        }).on('error',function(data){
            self.onerror(this, data);
        }).on('reconnect',function(attempt) {
            self.onconnect(this);
        }).on('reconnect_failed',function() {
            self.onerror(this, data);
        }).on('reconnect_error',function() {
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
    if (events.hasOwnProperty(ev)) {
        emit.apply(this, arguments);
        return this;
    }

    var args = toArray(arguments);
    var socket = this.pendingSocketQueue.dequeue();
    socket.emit(args);
    this.pendingSocketQueue.enqueue(socket);
    return this;
};

PSocket.prototype.on=function(ev){
    if(events.hasOwnProperty(ev)){
        return this.on(arguments);
    };
    for(var i=0;i<this.socketList.length;i++){
        this.socketList[i].on(arguments);
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
    if (this.connected) {
        for(var i=0;i<this.socketList.length;i++) {
            this.socketList[i].disconnect();
        }
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
    this.curSocketCnt++;

    this.socketList.push(socket);
    this.pendingSocketQueue.enqueue(socket);
    if(this.socketList.length==1)
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
    var idx = this.socketList.indexOf(socket);
    if(idx > -1){
        this.socketList.splice(idx,1);
    }
    if(this.socketList.length==0)
        this.emit('disconnect', reason);
};

PSocket.prototype.onerror=function(socket, err){
    this.emit('error',err);
};