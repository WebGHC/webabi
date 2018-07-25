var dec = new TextDecoder();
var enc = new TextEncoder();
var channel = new MessageChannel();
channel.port1.onmessage = handleMessageFromWasm;
var msgCount = 0;

function handleMessageFromWasm(msg) {
  // var d = utils.bufToStr(heap_uint8, bufPtr, bufPtr + count);
  // console.log('JSADDLE_OUT: "' + d + '"');
  // console.log('incoming message from wasm, msg:', msg);
  var m = dec.decode(msg.data.buf);
  // console.log('message m:', m);
  // jsaddleJs.exec(msg.data.buf);
  msgCount++;
  var reply = m + msgCount;
  var a = enc.encode(reply);
  var b = a.buffer;

  channel.port1.postMessage({buf: b}, [b]);
}

function jsaddleInit() {
  return channel.port2;
}
