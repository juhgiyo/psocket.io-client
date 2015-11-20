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
    this.uuid = UUID.create().toString();

    this.setup();
    this.sockets=[];
    for(var i=0 ;i <this.maxSocketCnt; i++){
        var socket = io(uri,opts);
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
        }).on('reconnect',function(attempt) {
            self.onconnect(socket);
        }).on('reconnect_attempt',function() {
            // TODO: not needed
        }).on('reconnecting',function(attempt) {
            // TODO: not needed
        }).on('reconnect_error',function(err) {
            self.onerror(socket,err);
        }).on('reconnect_failed',function() {
            self.onconnecterror(socket,  new Error('reconnect_error'));
        }).on('ppacket',function(ppacket){
            self.onreceive(socket,ppacket);
        }).on('puuid',function(data){
            self.onreceiveIdentity(socket);
        });
        this.sockets.push(socket);
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

    this.setup();

    for(var i=0;i<this.sockets.length;i++){
        this.sockets[i].connect();
    }
    return this;
};

PSocket.prototype.setup=function(){
    this.curConnectionTry=0;
    this.packetId=0;
    this.curReceivedPacketId=-1;
    this.connectedSockets=[];
    this.packetQueue= new Queue();
    this.pendingPacketQueue=new Queue();
    this.errorPacketQueue=new Queue();
    this.pendingClientQueue= new Queue();
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

PSocket.prototype.getNextPacketId=function(){
    var retId = this.packetId;
    if(this.packetId===Number.MAX_VALUE){
        this.packetId=-1;
    }
    this.packetId++;
    return retId;
}

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
    var self=this;
    var args = toArray(arguments);
    var cb;
    // event ack callback
    if ('function' == typeof args[args.length - 1]) {
         cb = args.pop();
    }

    var ppacket = {packetId:this.getNextPacketId(),data:args, cb : cb};
    this.packetQueue.enqueue(ppacket);
    this.sendPpacket();
    return this;
};

PSocket.prototype.sendPpacket=function(){
    while(!this.pendingClientQueue.isEmpty() && (!this.packetQueue.isEmpty() || !this.errorPacketQueue.isEmpty())){
        var socket = this.pendingClientQueue.dequeue();
        var sendPpacket;
        if(!this.errorPacketQueue.isEmpty())
        {
            sendPpacket= this.errorPacketQueue.dequeue();
        } else if (!this.packetQueue.isEmpty()){
            sendPpacket=this.packetQueue.dequeue();
        }
        this.pendingPacketQueue.enqueue(sendPpacket);
        var sendcb = sendPpacket.cb;
        socket.emit.apply(socket, ['ppacket', sendPpacket,this.onack(socket,sendcb)]);
    }
}

PSocket.prototype.onack=function(socket, cb) {
    var self = this;
  return function(data){
      self.pendingClientQueue.enqueue(socket);
      self.pendingPacketQueue.remove(data);
      if(cb)
          cb.apply(self,data.data);
  }
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
        var socket;
        while(socket= this.connectedSockets.shift()){
            socket.disconnect();
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
    var idx = this.connectedSockets.indexOf(socket);
    if(idx === -1){
        this.curConnectionTry++;
        this.connectedSockets.push(socket);
        if(this.connectedSockets.length==1){
            this.connected = true;
            this.disconnected = false;
            this.emit('connect');
        }
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
    var idx = this.connectedSockets.indexOf(socket);
    if(idx === -1){
        this.curConnectionTry++;
        if(this.curConnectionTry==this.maxSocketCnt && this.connectedSockets.length==0){
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
    var idx = this.connectedSockets.indexOf(socket);
    if(idx > -1){
        this.connectedSockets.splice(idx,1);
        this.pendingClientQueue.remove(socket);
        if(this.connectedSockets.length==0){
            this.connected = false;
            this.disconnected = true;
            this.emit('disconnect', reason);
        }

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
        data.data.id = data.id;
        while(!this.recvQueue.isEmpty() && this.curReceivedPacketId +1 == this.recvQueue.peek().packetId){
            var curPacket = this.recvQueue.deq();
            this.curReceivedPacketId = curPacket.packetId;
            if(this.curReceivedPacketId===Number.MAX_VALUE)
                this.curReceivedPacketId=-1;
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
    var self =this;
    socket.emit('puuid',{data:this.uuid},function(data){
        // start tracking send error after uuid
        socket.on('error',function(ppacket){
            self.onerror(socket, ppacket);
        });
        // preparing send after uuid ack
        self.pendingClientQueue.enqueue(socket);
        self.sendPpacket();
    });
};

/**
 * Called upon socket `error`.
 *
 * @param {Object} socket
 * @param {Error} err
 * @api private
 */
PSocket.prototype.onerror=function(socket, ppacket){
    this.pendingClientQueue.enqueue(socket);
    this.errorPacketQueue.enqueue(ppacket);
    this.sendPpacket();
    this.emit('error',ppacket.data);
};