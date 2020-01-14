// Atomics.wait is not possible on main thread
// so this worker takes the messages from jsaddle.js and appends to the SharedArrayBuffer

onmessage = function (msg) {
  var jsaddleMsgBufArrayInt32 = msg.data.jsaddleMsgBufArrayInt32;
  var jsaddleMsgBufArray32 = msg.data.jsaddleMsgBufArray32;
  var jsaddleMsgBufArray = msg.data.jsaddleMsgBufArray;
  const uint8 = new Uint8Array(msg.data.buf);
  var appendMsgToSharedBuf = function () {
    var isAlreadyLocked = Atomics.compareExchange(jsaddleMsgBufArrayInt32, 0, 0, 10);
    if (isAlreadyLocked === 1) {
      Atomics.wait(jsaddleMsgBufArrayInt32, 0, 0, 10);
      appendMsgToSharedBuf();
    } else {
      var len = uint8.length;
      var prevLen = jsaddleMsgBufArray32[1];
      var totalLen = len + prevLen;
      var startOffset = prevLen + 8; // Two 32 bit uint
      var i = len;
      while (i--) jsaddleMsgBufArray[startOffset + i] = uint8[i];
      jsaddleMsgBufArray32[1] = totalLen;
      // Release the lock
      jsaddleMsgBufArrayInt32[0] = 0;
    }
  };
  appendMsgToSharedBuf();
}
