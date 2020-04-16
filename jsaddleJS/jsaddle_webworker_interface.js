// JSaddle wasm JS interface for webworker based runtime architecture

var dec = new TextDecoder();
var enc = new TextEncoder();

function jsaddleHandler(msg) {
  var m = dec.decode(msg);
  var batch = JSON.parse(m);
  runBatchWrapper(batch, sendAPI, null /* sendSync */ );
}

// Webabi Device -> JS
// MessageChannel is used to receive messages for each SYS_Write call
// This is a non-blocking call on the webabi side
//
var channel = new MessageChannel();
channel.port1.onmessage = jsaddleHandlerMsgs;
var msgbuffer = new Uint8Array(0);

function appendBuffer( buffer1, buffer2 ) {
  var tmp = new Uint8Array( buffer1.byteLength + buffer2.byteLength );
  tmp.set( new Uint8Array( buffer1 ), 0 );
  tmp.set( new Uint8Array( buffer2 ), buffer1.byteLength );
  return tmp.buffer;
}

function jsaddleHandlerMsgs (msgs) {
  msgbuffer = appendBuffer( msgbuffer, msgs.data.buffer );
  if ( msgbuffer.byteLength > 4 ) {
	  var dataview = new DataView(msgbuffer);
	  size = dataview.getUint32(0);
	  if ( msgbuffer.byteLength >= 4 + size) {
	    thisMsg = msgbuffer.slice(4, size + 4);
	    rest = msgbuffer.slice(4+size);
	    jsaddleHandler(thisMsg);
	    msgbuffer = new Uint8Array(0);
	    if (rest.byteLength > 0) {
		    jsaddleHandlerMsgs(rest);
	    }
	  }
  }
}

// JS -> Webabi Device
// SharedArrayBuffer is used to communicate back to JSaddleDevice in wasm side.
// The jsaddle-wasm will do a SYS_read to read the data.
//

// The first Int (32 bits) hold a lock to the read/write of this shared buffer
// and this value should be read/written with atomic operations.
// The second UInt (32 bits) indicates the total size of payload currently in the buffer
// After that buffer contains the payload
// Note: the payload can contain multiple encoded messages
// Each message is prepended with its own size.
var jsaddleMsgSharedBuf = new SharedArrayBuffer(10*1024*1024);
var jsaddleMsgBufArray = new Uint8Array(jsaddleMsgSharedBuf);
var jsaddleMsgBufArray32 = new Uint32Array(jsaddleMsgSharedBuf);
// Atomics.wait need Int32
var jsaddleMsgBufArrayInt32 = new Int32Array(jsaddleMsgSharedBuf);

var jsaddle_sendMsgWorkerPathVar = 'jsaddle_sendMsgWorker.js';
if (typeof(jsaddle_sendMsgWorkerPath) !== 'undefined') {
  jsaddle_sendMsgWorkerPathVar = jsaddle_sendMsgWorkerPath;
}
var jsaddle_sendMsgWorker = new Worker(jsaddle_sendMsgWorkerPathVar);

function sendAPI (msg) {
  var str = JSON.stringify(msg);
  var a = enc.encode(str);
  var size = a.length;
  var b = new ArrayBuffer(size + 4);
  var dataview = new DataView(b);
  dataview.setUint32(0, size);
  const uint8 = new Uint8Array(b);
  uint8.set(a, 4);
  jsaddle_sendMsgWorker.postMessage({
    buf: b,
    jsaddleMsgBufArrayInt32: jsaddleMsgBufArrayInt32,
    jsaddleMsgBufArray32: jsaddleMsgBufArray32,
    jsaddleMsgBufArray: jsaddleMsgBufArray
  }, [b]);
}

function jsaddleJsInit() {
  return {
    jsaddleListener: channel.port2,
    jsaddleMsgBufArray: jsaddleMsgBufArray,
    jsaddleMsgBufArray32: jsaddleMsgBufArray32,
    jsaddleMsgBufArrayInt32: jsaddleMsgBufArrayInt32
  };
}
