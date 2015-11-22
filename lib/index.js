
/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var debug = require('debug')('psocket.io-client');
var PSocket = require('./psocket');


/**
 * Module exports.
 */

module.exports = exports = parallelize;


function parallelize(uri, opts){
    if (typeof uri == 'object') {
        opts = uri;
        uri = undefined;
    }
    opts = opts || {};
    opts.maxSocketCnt = opts.maxSocketCnt || 20;
    opts.forceNew = true;
    opts.sequentialRecv = opts.sequentialRecv || true;

    var pio = PSocket(uri,opts);
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

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */
exports.PSocket = require('./psocket');