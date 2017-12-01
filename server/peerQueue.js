'use strict';

class PeerQueue {
  constructor(maxSize, peerLimit) {
    this.maxSize = maxSize || 200;
    this.peerLimit = peerLimit || 10;
    this.peers = {};
    this.reqs = [];
  }

  reqShift() {
    if (this.length() > 0) {
      let req = this.reqs.shift();
      this.peers[req.infohash.toString('hex')] = [];
      return req;
    }
  }

  push(peer) {
    let infohashHex = peer.infohash.toString('hex');
    let peers = this.peers[infohashHex];

    if (peers && peers.length < this.peerLimit) {
      peers.push(peer);
    }
    else if (this.length() < this.maxSize) {
      this.reqs.push(peer);
    }
  }

  shift(infohash, successful) {
    if (infohash) {
      let infohashHex = infohash.toString('hex');
      if (successful === true) {
        delete this.peers[infohashHex];
      }
      else {
        let peers = this.peers[infohashHex];
        if (peers) {
          if (peers.length > 0) {
            return peers.shift();
          }
          else {
            delete this.peers[infohashHex];
          }
        }
      }
    }
    return this.reqShift();
  }

  length() {
    return this.reqs.length;
  }
}

module.exports = PeerQueue;