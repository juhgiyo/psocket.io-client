
/**
 * Module dependencies.
 */

var io = require('socket.io-client');
var parser = require('socket.io-parser');
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
    opts.forceNew = true;

    for(var i=0 ;i <opts.streamCnt; i++){
        socketList.add(io(uri,opts));
    }


    var pio;
    return pio;
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * `connect`.
 *
 * @param {String} uri
 * @api public
 */
exports.connect = parallelize;