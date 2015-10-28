/**
 * Module dependencies.
 */

var io = require('socket.io-client');
var Queue = require('queue');
var Emitter = require('component-emitter');
var PriorityQueue=require('priorityqueuejs');
var UUID = require('uuid-js');

/**
 * Module exports.
 */
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

/**
 * `PSocket` constructor.
 *
 * @api public
 */

function PSocket(uri, opts){
    if (!(this instanceof PSocket)) return new PSocket(uri, opts);

    var self = this;

    if (typeof uri == 'object') {
        opts = uri;
        uri = undefined;
    }
    opts = opts || {};
    opts.maxSocketCnt = opts.maxSocketCnt || 20;
    opts.forceNew = true;

    this.maxSocketCnt = opts.maxSocketCnt;
    this.sequentialRecv = opts.sequentialRecv || true;
    this.reconnection = (opts.reconnection !== false);

    this.connected = false;
    this.disconnected = true;
    this.uuid = UUID.create();

    setup();

    for(var i=0 ;i <this.maxSocketCnt; i++){
        var socket = io(uri,opts);
        this.socketList.add(socket);
        socket.on('connect',function(){
            self.onconnect(socket);
        }).on('connect_error',function() {
            if(!self.reconnection)
                self.onconnecterror(socket, new Error('connect_error'));
        }).on('connect_timeout',function() {
            if(!self.reconnection)
                self.onconnecterror(socket, new Error('connect_timeout'));
        }).on('disconnect',function(reason){
            self.ondisconnect(socket, reason);
        }).on('error',function(err){
            self.onerror(socket, err);
        }).on('reconnect',function(attempt) {
            self.onconnect(socket);
        }).on('reconnect_failed',function() {
            self.onconnecterror(socket,  new Error('reconnect_error'));
        }).on('reconnect_error',function(err) {
            self.onerror(socket,err);
        }).on('ppacket',function(data){
            self.onreceive(socket,data);
        }).on('pidentity',function(){
            self.onreceiveIdentity(socket);
        });
    }
};

/**
 * Mix in `Emitter`.
 */
Emitter(PSocket.prototype);

/**
 * "Opens" the parallel socket.
 *
 * @api public
 */
PSocket.prototype.open=
PSocket.prototype.connect=function(){
    if (this.connected) return this;

    setup();

    for(var i=0;i<this.socketList.length;i++){
        this.socketList[i].connect();
    }
    return this;
};

PSocket.prototype.setup=function(){
    this.curSocketCnt = 0;
    this.curConnectionTry=0;
    this.packetId=0;
    this.curReceivedPacketId=-1;
    this.pendingSocketQueue=new Queue();
    this.recvQueue = new PriorityQueue(function(a,b){
        return a.packetId - b.packetId;
    });
}
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
    var ppacket = {packetId:this.packetId++,data:args};
    socket.emit.apply(socket, ['ppacket', ppacket]);
    this.pendingSocketQueue.enqueue(socket);
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

    var idx = this.socketList.indexOf(socket);
    if(idx === -1){
        this.curConnectionTry++;
        this.curSocketCnt++;
        this.socketList.push(socket);
        this.pendingSocketQueue.enqueue(socket);
        if(this.socketList.length==1)
            this.emit('connect');
    }
};
/**
 * Called upon socket `connection errors`.
 *
 * @param {Object} socket
 * @param {Object} err
 * @api private
 */
PSocket.prototype.onconnecterror=function(socket, err){
    var idx = this.socketList.indexOf(socket);
    if(idx === -1){
        this.curConnectionTry++;
        if(this.curConnectionTry==this.maxSocketCnt && this.curSocketCnt==0){
            this.emit('connect_error');
        }
    }
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
        this.curSocketCnt--;
        if(this.socketList.length==0)
            this.emit('disconnect', reason);
    }
};

/**
 * Called upon socket `receive`.
 *
 * @param {Object} socket
 * @param {Object} data
 * @api private
 */
PSocket.prototype.onreceive=function(socket, data) {
    if (self.sequentialRecv) {
        this.recvQueue.enq(data);
        while(!this.recvQueue.isEmpty() && this.curReceivedPacketId +1 == this.recvQueue.peek().packetId){
            var curPacket = this.recvQueue.deq();
            this.curReceivedPacketId = curPacket.packetId;
            emit.apply(this, curPacket.data);
        }
    } else {
        emit.apply(this, data.data);
    }
};

/**
 * Called upon socket `receive identity request`.
 *
 * @param {Object} socket
 * @api private
 */
PSocket.prototype.onreceiveIdentity=function(socket){
    socket.emit('identity',{data:this.uuid});
};

/**
 * Called upon socket `error`.
 *
 * @param {Object} socket
 * @param {Error} err
 * @api private
 */
PSocket.prototype.onerror=function(socket, err){
    this.emit('error',err);
};