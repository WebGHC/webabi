// Atomics.wait is not possible on main thread
// so this worker takes the messages from jsaddle.js and appends to the SharedArrayBuffer

// The payload (msg) contains 4 bytes for length + actual message
// The whole payload is written to the SharedArrayBuffer in one go
// but it might be read by the other side in pieces
// While the HS side is reading the messages, it will keep the lock (the value of 0 index will be non-zero)
onmessage = function (msg) {
  var jsaddleMsgBufArrayInt32 = msg.data.jsaddleMsgBufArrayInt32;
  var jsaddleMsgBufArray32 = msg.data.jsaddleMsgBufArray32;
  var jsaddleMsgBufArray = msg.data.jsaddleMsgBufArray;
  const uint8 = new Uint8Array(msg.data.buf);
  var appendMsgToSharedBuf = function () {
    var isAlreadyLocked = Atomics.compareExchange(jsaddleMsgBufArrayInt32, 0, 0, 1);
    if (isAlreadyLocked !== 0) {
      Atomics.wait(jsaddleMsgBufArrayInt32, 0, 0, 50);
      return false;
    } else {
      var len = uint8.length;
      var prevLen = jsaddleMsgBufArray32[1];
      var totalLen = len + prevLen;
      if (totalLen > 10 * 1024 * 1024) { // Protection against over filling the SharedArrayBuffer
        console.log("JSaddle.js warning: SharedArrayBuffer overflow!");
        // Release the lock
        jsaddleMsgBufArrayInt32[0] = 0;
        return false;
      }
      var startOffset = prevLen + 8; // Two 32 bit uint
      var i = len;
      while (i--) jsaddleMsgBufArray[startOffset + i] = uint8[i];
      jsaddleMsgBufArray32[1] = totalLen;
      // Release the lock
      jsaddleMsgBufArrayInt32[0] = 0;
      Atomics.notify(jsaddleMsgBufArrayInt32, 0);
      return true;
    }
  };
  var done = false;
  while (done === false) {
    done = appendMsgToSharedBuf();
  };
}
