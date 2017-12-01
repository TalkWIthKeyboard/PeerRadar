const DHTSpider = require('./server/dhtSpider');
const BTClient = require('./server/btClient');

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