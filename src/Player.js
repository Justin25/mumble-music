var fs = require("fs");

function Player(connection) {
	this.connection = connection;
	this.gain = 0.25;
	this.buf = Buffer.alloc(48000);
	this.isPlaying = false;
	this._createStream();
}

Player.prototype._createStream = function() {
	this.stream = this.connection.inputStream();
	this.stream.setGain(this.gain);
	this.stream.on('drain', () => this._fillBuf());
}

Player.prototype._fillBuf = function() {
	if (this.isPlaying) {
		fs.read(this.fd, this.buf, 0, 48000, null, (err, bytesRead, buffer) => {
			if (err) throw err;
			if (bytesRead == 0) {
				console.info("[INFO] Song timeout.");
				this.isPlaying = false;
				this._delete();
				// Sleep for half a second so stream drains out fully before resolving
				setTimeout(this.promise.resolve, 500);
			}
			else {
				this.currentPos += 1; // num of bufs filled
				this.stream.write(buffer.slice(0, bytesRead));
				if (bytesRead < 48000) this._fillBuf(); // Refill buffer one last time in case drain event isn't called
			}
		});
	}
}

Player.prototype._delete = function() {
	try {
		fs.closeSync(this.fd);
		fs.unlinkSync(this.filename);
	}
	catch (e) {}
}

Player.prototype.setGain = function(gain) {
	this.gain = gain;
	this.stream.setGain(gain);
}

Player.prototype.playFile = function(filename) {
	if (!this.isPlaying) {
		return new Promise((res, rej) => {
			this.promise = {
					resolve: res,
					reject: rej
			};
			this.filename = filename;
			this.isPlaying = true;
			this.currentPos = 0;
			this.fd = fs.openSync(filename, 'r', 666);
			this._fillBuf();
		});
	}
}

Player.prototype.getCurrentPos = function() {
	if (this.isPlaying) return Math.floor(this.currentPos / 2); // gets position in seconds
	else return 0;
}

Player.prototype.stop = function() {
	this._delete();
	this.stream.close();
	this._createStream();
	this.isPlaying = false;
	let promise = this.promise;
	this.promise = undefined;
	if (promise) promise.resolve();
}

Player.prototype.pause = function() {
	this.stream.close();
	this._createStream();
	this.isPaused = true;
}

Player.prototype.resume = function() {
	if (this.isPaused) this._fillBuf();
	this.isPaused = false;
}

module.exports = Player;
