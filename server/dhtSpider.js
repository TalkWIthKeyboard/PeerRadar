const bencode = require('bencode');
const dgram = require('dgram');
const _ = require('underscore');
const util = require('./util');
const KTable = require('./ktable');

let BOOTSTRAP_NODES = [
  {address: 'router.bittorrent.com', port: 6881},
  {address: 'dht.transmissionbt.com', port: 6881}
];

let TID_LENGTH = 4;
let NODES_MAX_SIZE = 200;
let TOKEN_LENGTH = 2;

class DHTSpider {
  constructor(options) {
    this.btclient = options.btclient;
    this.address = options.address;
    this.port = options.port;
    this.udp = dgram.createSocket('udp4');
    this.ktable = new KTable(options.nodesMaxSize || NODES_MAX_SIZE);
  }

  sendKPRC(msg, rinfo) {
    try {
      let buf = bencode.encode(msg);
      this.udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
    } catch (err) {
      console.log(err);
    }
  }

  onFindNodeResponse(nodes) {
    let _nodes = util.decodeNodes(nodes);
    _.each(_nodes, node => {
      if (
        node.address !== this.address
        && node.nid !== this.ktable.nid
        && node.port < 65536
        && node.port > 0
      )
        this.ktable.push(node);
    });
  }

  sendFindNodeRequest(rinfo, nid) {
    let _nid =
      nid != undefined
        ? util.genNeighborID(nid, this.ktable.nid)
        : this.ktable.nid;
    let msg = {
      t: util.randomID().slice(0, TID_LENGTH),
      y: 'q',
      q: 'find_node',
      a: {
        id: _nid,
        target: util.randomID()
      }
    };
    this.sendKPRC(msg, rinfo);
  }

  joinDHTNetwork() {
    _.each(BOOTSTRAP_NODES, node => {
      this.sendFindNodeRequest({
        address: node.address,
        port: node.port
      })
    });
  }

  makeNeighbours() {
    _.each(this.ktable.nodes, node => {
      this.sendFindNodeRequest({
        address: node.address,
        port: node.port
      })
    });
    this.ktable.nodes = [];
  }

  onGetPeersRequest(msg, rinfo) {
    try {
      let infohash = msg.a.info_hash;
      let tid = msg.t;
      let nid = msg.a.id;
      let token = infohash.slice(0, TOKEN_LENGTH);

      if (tid === undefined || infohash.length !== 20 || nid.length !== 20) {
        throw new Error;
      }

      this.sendKPRC({
        t: tid,
        y: 'r',
        r: {
          id: util.genNeighborID(infohash, this.ktable.nid),
          nodes: '',
          token: token
        }
      }, rinfo);
    } catch (err) {
      console.log(err);
    }
  }

  onAnnouncePeerRequest(msg, rinfo) {
    let port, infohash, tid, nid, token;

    try {
      infohash = msg.a.info_hash;
      tid = msg.t;
      nid = msg.a.id;
      token = msg.a.token;

      if (tid == undefined) {
        throw new Error;
      }
    } catch (err) {
      return;
    }

    if (infohash.slice(0, TOKEN_LENGTH).toString() != token.toString()) {
      return;
    }

    port = (msg.a.implied_port != undefined && msg.a.implied_port != 0)
      ? rinfo.port
      : msg.a.port || 0;

    if (port >= 65536 || port <= 0) {
      return;
    }

    this.sendKPRC({
      t: tid,
      y: 'r',
      r: {
        id: util.genNeighborID(nid, this.ktable.nid)
      }
    }, rinfo);

    console.log(`address: ${rinfo.address}, port: ${port}, infohash: ${infohash.toString('hex')} `);
    this.btclient.add({address: rinfo.address, port: port}, infohash);
  }

  onMessage(msg, rinfo) {
    let _msg = bencode.decode(msg);
    if (_msg.y == 'r' && _msg.r.nodes) {
      this.onFindNodeResponse(_msg.r.nodes);
    } else if (_msg.y == 'q' && _msg.q == 'get_peers') {
      this.onGetPeersRequest(_msg, rinfo);
    } else if (_msg.y == 'q' && _msg.q == 'announce_peer') {
      this.onAnnouncePeerRequest(_msg, rinfo);
    }
  }

  start() {
    this.udp.bind(this.port, this.address);
    this.udp.on('listening', () => {
      console.log(`UDP Server listening on ${this.address}:${this.port}`)
    });
    this.udp.on('message', (msg, rinfo) => {
      this.onMessage(msg, rinfo);
    });
    this.udp.on('error', (err) => {
      console.log('error: ', err);
    });

    setInterval(() => {
      if (this.btclient.isIdle()) {
        this.joinDHTNetwork();
        this.makeNeighbours();
      }
    }, 1000);
  }
}

exports.start = function (options) {
  (new DHTSpider(options)).start();
};