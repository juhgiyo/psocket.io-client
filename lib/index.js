
/**
 * Module dependencies.
 */

var io = require('socket.io-client');

/**
 * Module exports.
 */

module.exports = exports = parallelize;
var socketList = [];
function parallelize(uri, opts){
    if (typeof uri == 'object') {
        opts = uri;
        uri = undefined;
    }
    opts = opts || {};
    opts.streamCnt = opts.streamCnt || 20;

    for(var i=0 ;i <opts.streamCnt; i++){
        socketList.add(io(uri,opts));
    }


    var pio;
    return pio;
}