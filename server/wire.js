const stream = require('stream');
const crypto = require('crypto');
const util = require('util');
const BitField = require('bitfield');
const bencode = require('bencode');
let utils = require('./util');

let BT_RESERVED = new Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x01]);
let BT_PROTOCOL = new Buffer('BitTorrent protocol');
let PIECE_LENGTH = Math.pow(2, 14);
let MAX_METADATA_SIZE = 10000000;
let BITFIELD_GROW = 1000;
let EXT_HANDSHAKE_ID = 0;
let BT_MSG_ID = 20;

let Wire = function(infohash) {
  stream.Duplex.call(this);

  this._bitfield = new BitField(0, { grow: BITFIELD_GROW });
  this._infohash = infohash;

  this._buffer = [];
  this._bufferSize = 0;

  this._next = null;
  this._nextSize = 0;

  this._metadata = null;
  this._metadataSize = null;
  this._numPieces = 0;
  this._ut_metadata = null;

  this._onHandshake();
};

util.inherits(Wire, stream.Duplex);

Wire.prototype._onMessageLength = function (buffer) {
  if (buffer.length >= 4) {
    let length = buffer.readUInt32BE(0);
    if (length > 0) {
      this._register(length, this._onMessage)
    }
  }
};

Wire.prototype._onMessage = function (buffer) {
  this._register(4, this._onMessageLength)
  if (buffer[0] == BT_MSG_ID) {
    this._onExtended(buffer.readUInt8(1), buffer.slice(2));
  }
};

Wire.prototype._onExtended = function(ext, buf) {
  if (ext === 0) {
    try {
      this._onExtHandshake(bencode.decode(buf));
    }
    catch (err) {
      this._fail();
    }
  }
  else {
    this._onPiece(buf);
  }
};

Wire.prototype._register = function (size, next) {
  this._nextSize = size;
  this._next = next;
};

Wire.prototype.end = function() {
  stream.Duplex.prototype.end.apply(this, arguments);
};

Wire.prototype._onHandshake = function() {
  this._register(1, function(buffer) {
    if (buffer.length == 0) {
      this.end();
      return this._fail();
    }
    let pstrlen = buffer.readUInt8(0);
    this._register(pstrlen + 48, function(handshake) {
      let protocol = handshake.slice(0, pstrlen);
      if (protocol.toString() !== BT_PROTOCOL.toString()) {
        this.end();
        this._fail();
        return;
      }
      handshake = handshake.slice(pstrlen);
      if ( !!(handshake[5] & 0x10) ) {
        this._register(4, this._onMessageLength);
        this._sendExtHandshake();
      }
      else {
        this._fail();
      }
    }.bind(this));
  }.bind(this));
};

Wire.prototype._onExtHandshake = function(extHandshake) {
  if (!extHandshake.metadata_size || !extHandshake.m.ut_metadata
    || extHandshake.metadata_size > MAX_METADATA_SIZE) {
    this._fail();
    return;
  }

  this._metadataSize = extHandshake.metadata_size;
  this._numPieces = Math.ceil(this._metadataSize / PIECE_LENGTH);
  this._ut_metadata = extHandshake.m.ut_metadata;

  this._requestPieces();
}

Wire.prototype._requestPieces = function() {
  this._metadata = new Buffer(this._metadataSize);
  for (let piece = 0; piece < this._numPieces; piece++) {
    this._requestPiece(piece);
  }
};

Wire.prototype._requestPiece = function(piece) {
  let msg = Buffer.concat([
    new Buffer([BT_MSG_ID]),
    new Buffer([this._ut_metadata]),
    bencode.encode({msg_type: 0, piece: piece})
  ]);
  this._sendMessage(msg);
};

Wire.prototype._sendPacket = function(packet) {
  this.push(packet);
};

Wire.prototype._sendMessage = function(msg) {
  let buf = new Buffer(4);
  buf.writeUInt32BE(msg.length, 0);
  this._sendPacket(Buffer.concat([buf, msg]));
};

Wire.prototype.sendHandshake = function() {
  let peerID = utils.randomID();
  let packet = Buffer.concat([
    new Buffer([BT_PROTOCOL.length]),
    BT_PROTOCOL, BT_RESERVED, this._infohash,  peerID
  ]);
  this._sendPacket(packet);
};

Wire.prototype._sendExtHandshake = function() {
  let msg = Buffer.concat([
    new Buffer([BT_MSG_ID]),
    new Buffer([EXT_HANDSHAKE_ID]),
    bencode.encode({m: {ut_metadata: 1}})
  ]);
  this._sendMessage(msg);
};

Wire.prototype._onPiece = function(piece) {
  let dict, trailer;
  try {
    let str = piece.toString();
    let trailerIndex = str.indexOf('ee') + 2;
    dict = bencode.decode(str.substring(0, trailerIndex));
    trailer = piece.slice(trailerIndex);
  }
  catch (err) {
    this._fail();
    return;
  }
  if (dict.msg_type != 1) {
    this._fail();
    return;
  }
  if (trailer.length > PIECE_LENGTH) {
    this._fail();
    return;
  }
  trailer.copy(this._metadata, dict.piece * PIECE_LENGTH);
  this._bitfield.set(dict.piece);
  this._checkDone();
};

Wire.prototype._checkDone = function () {
  let done = true;
  for (let piece = 0; piece < this._numPieces; piece++) {
    if (!this._bitfield.get(piece)) {
      done = false;
      break;
    }
  }
  if (!done) {
    return
  }
  this._onDone(this._metadata);
};

Wire.prototype._onDone = function(metadata) {
  try {
    let info = bencode.decode(metadata).info;
    if (info) {
      metadata = bencode.encode(info);
    }
  }
  catch (err) {
    this._fail();
    return;
  }
  let infohash = crypto.createHash('sha1').update(metadata).digest('hex');
  if (this._infohash.toString('hex') != infohash ) {
    this._fail();
    return false;
  }
  this.emit('metadata', {info: bencode.decode(metadata)}, this._infohash);
};

Wire.prototype._fail = function() {
  this.emit('fail');
};

Wire.prototype._write = function (buf, encoding, next) {
  this._bufferSize += buf.length;
  this._buffer.push(buf);

  while (this._bufferSize >= this._nextSize) {
    let buffer = Buffer.concat(this._buffer);
    this._bufferSize -= this._nextSize;
    this._buffer = this._bufferSize
      ? [buffer.slice(this._nextSize)]
      : [];
    this._next(buffer.slice(0, this._nextSize));
  }

  next(null);
};

module.exports = Wire;
