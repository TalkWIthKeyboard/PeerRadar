const _ = require('underscore');
const Promise = require('bluebird');
const util = require('util');
const http = require('http');
const url = require('url');
const socket = require('net');
const zlib = require('zlib');
const torrentStream = require('torrent-stream');

let torrentUrl = [
  'http://torrage.com/torrent/%s.torrent'
];

let headers = {
  'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
  'accept-language': 'en-US,en;q=0.8',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2',
  'accept-encoding': 'gzip,deflate'
};

// let httpRequest = (option, cb) => {
//   http.request(option, (res) => {
//     let chunks = [];
//     res.on('data', function (chunk) {
//       chunks.push(chunk);
//     });
//
//     res.on('end', function () {
//       if (res.statusCode !== 200 || res.headers['content-type'].indexOf('text/html') !== -1) {
//         cb(404);
//         return;
//       }
//
//       let buffer = Buffer.concat(chunks);
//       let encoding = res.headers['content-encoding'];
//       switch (encoding) {
//         case 'gzip':
//           zlib.gunzip(buffer, (err, decoded) => {
//             cb(err, decoded);
//           });
//           break;
//         case 'deflate':
//           zlib.inflate(buffer, (err, decoded) => {
//             cb(err, decoded);
//           });
//           break;
//         default:
//           cb(null, buffer.toString());
//       }
//     });
//   }).on('error', (err) => {
//     cb(err);
//   }).end();
// };

let _download = (infohash) => {
  let socket = new net.Socket();

  socket.setTimeout(50000);
  socket.connect()
};

let Download = (infohash) => {
  let _infohash = infohash.toUpperCase();
  let downloadUrl = torrentUrl.slice(Math.floor(torrentUrl.length * Math.random()), 1)[0];
  downloadUrl = util.format(downloadUrl, _infohash);

  let downloadUrlObj = url.parse(downloadUrl);
  let option = {
    hostname: downloadUrlObj.hostname,
    path: downloadUrlObj.path,
    port: 80,
    method: 'GET',
    secureProtocol: 'SSLv3_method',
    headers: headers
  };

  // httpRequest(option, (err, data) => {
  //   console.log('err:', err);
  //   console.log('data:', data);
  // })

  let engine = torrentStream(`magnet:?xt=urn:btih:${infohash}\n`);
  engine.on('ready', function() {
    console.log(engine.files.length);
    engine.files.forEach(function(file) {
      console.log('filename:', file.name);
      // let stream = file.createReadStream();
      // stream is readable stream to containing the file content
    });
  });

  engine.on('torrent', () => {
    console.log(engine);
  })

};

Download('1f5782d3d2549a89def0c27ebad623911a21284b');

