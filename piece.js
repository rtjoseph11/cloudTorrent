var crypto = require('crypto');
var events = require('events');
var util = require('util');
var fs = require('fs');
module.exports = function(sha, length, index, files, standardLength){
  events.EventEmitter.call(this);
  this.sha = sha;
  this.data = new Buffer(length);
  this.currentLength = 0;
  this.assignedPeer = null;
  this.index = index;
  this.files = files;
  this.standardLength = standardLength;
};

util.inherits(module.exports, events.EventEmitter);

//consider doing the piece writing at the pieceField level since I have the index
module.exports.prototype.writeChunk = function(buffer){
  var index = buffer.readUInt32BE(0);
  var begin = buffer.readUInt32BE(4);
  if (begin !== this.currentLength || index !== this.index){
    throw new Error ('begin or index did not match up indices: ' + this.index + ", " + index + "begins: " + begin + ", " + this.currentLength);
  } else {
    buffer.copy(this.data, this.currentLength, 8);
    this.currentLength += buffer.length - 8;
    if (this.currentLength === this.data.length){
      this.validate();
    } else {
      this.assignedPeer.getPiece();
    }
  }
};

module.exports.prototype.validate = function(){
  if (crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    console.log('succesfully received piece ', this.index);
    this.writeToDisk();
    this.assignedPeer.assignedPiece = null;
    this.emit('pieceFinished', this);
    this.assignedPeer.emit('pieceFinished');
  } else {
    this.currentLength = 0;
    console.log('peer ', this.assignedPeer.id, ' failed to download piece ', this.index);
    var peer = this.assignedPeer;
    this.assignedPeer = null;
    peer.emit('pieceFailed', this.assignedPeer);
  }
};

module.exports.prototype.writeToDisk = function(){
  var used = 0;
    for (var i = 0; i < this.files.length; i++){
      console.log('writing ', this.data.slice(used, used + this.files[i].writeLength).length, ' bytes at position ', this.files[i].start, ' in file ', i);
      var pieceWriter = fs.createWriteStream(this.files[i].path, {start: this.files[i].start, flags: 'r+'});
      pieceWriter.end(this.data.slice(used, used + this.files[i].writeLength));
      used += this.files[i].writeLength;
    }
};