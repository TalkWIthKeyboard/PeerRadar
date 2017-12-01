const EventEmitter = require('events');
const util = require('util');
const net = require('net');
const Wire = require('./wire');
const bencode = require('bencode');
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

  next(infohash, successful) {
    let req = this.peers.shift(infohash, successful);
    if (req) {
      this.ignore(req.infohash.toString('hex'), req.info, drop => {
        if (!drop) {
          this.emit('download', req.rinfo, req.infohash);
        }
      })
    }
  }

  add(rinfo, infohash) {
    this.peers.push({
      infohash: infohash,
      rinfo: rinfo
    });
    if (this.activeConnections < this.maxConnections && this.peers.length() > 0) {
      this.next();
    }
  }

  download(rinfo, infohash) {
    this.activeConnections++;

    let successful = false;
    let socket = new net.Socket();

    socket.setTimeout(this.timeout || 5000);
    socket.connect(rinfo.port, rinfo.address, function() {
      let wire = new Wire(infohash);
      socket.pipe(wire).pipe(socket);

      wire.on('metadata', function(metadata, infoHash) {
        successful = true;
        this.emit('complete', metadata, infoHash, rinfo);
        console.log(bencode.encode({'info': metadata.info}));
        socket.destroy();
      }.bind(this));

      wire.on('fail', function() {
        socket.destroy();
      }.bind(this));

      wire.sendHandshake();
    }.bind(this));

    socket.on('error', function(err) {
      socket.destroy();
    }.bind(this));

    socket.on('timeout', function(err) {
      socket.destroy();
    }.bind(this));

    socket.once('close', function() {
      this.activeConnections--;
      this.next(infohash, successful);
    }.bind(this));
  }
}

module.exports = BTClient;