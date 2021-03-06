const DHTSpider = require('./server/dhtSpider');
const BTClient = require('./server/btClient');
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/PeerRadar');

let btclient = new BTClient({
  timeout: 1000 * 10,
  ignore: undefined,
  maxConnections: 800
});

DHTSpider.start({
  btclient: btclient,
  address: '0.0.0.0',
  port: 6881,
  nodesMaxSize: 4000
});
console.log(Peer);

