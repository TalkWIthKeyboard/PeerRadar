const EventEmitter = require('events');
const util = require('util');
const PeerQueue = require('./peerQueue');

class BTClient extends EventEmitter {
  constructor(options) {
    super();

    this.timeout = options.timeout;
    this.maxConnections = options.maxConnections || 200;
    this.activeConnections = 0;
    this.peers = new PeerQueue(this.maxConnections);

    if (typeof options.ignore === 'function') {
      this.ignore = options.ignore;
    } else {
      this.ignore = (infohash, rinfo, cb) => {
        cb(false);
      }
    }
  }

  isIdle() {
    return this.peers.length() === 0;
  }
}

module.exports = BTClient;