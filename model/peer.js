const mongoose = require('mongoose');

let PeerSchema = new mongoose.Schema({
  infohash: String,
  files: [String],
  path: String,
  address: String,
  port: Number,
  createAt: {
    type: Date,
    default: Date.now()
  },
  updateAt: {
    type: Date,
    default: Date.now()
  }
});

PeerSchema.pre('save', function (next) {
  if (this.isNew) {
    this.createAt = this.updateAt = Date.now()
  }
  else {
    this.updateAt = Date.now()
  }
  next()
});

module.exports = mongoose.model('peer', PeerSchema);