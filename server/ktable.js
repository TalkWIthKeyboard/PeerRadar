const util = require('./util');

class KTable {
  constructor(maxsize) {
    this.nid = util.randomID();
    this.nodes = [];
    this.maxsize = maxsize;
  }

  push(node) {
    if (this.nodes.length >= this.maxsize) {
      return;
    }
    this.nodes.push(node);
  }

  length() {
    return this.nodes.length;
  }
}

module.exports = KTable;