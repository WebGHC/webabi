// JSaddle JS code
// This code is copied from jsaddle/js/jsaddle-core.js

function jsaddleCoreJs(global, sendRsp, processSyncCommandWithRsp, RESPONSE_BUFFER_MAX_SIZE) {
  /*

  Queue.js

  A function to represent a queue

  Created by Kate Morley - http://code.iamkate.com/ - and released under the terms
  of the CC0 1.0 Universal legal code:

  http://creativecommons.org/publicdomain/zero/1.0/legalcode

  */

  /* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
   * items are added to the end of the queue and removed from the front.
   */
  function Queue(){

    // initialise the queue and offset
    var queue  = [];
    var offset = 0;

    // Returns the length of the queue.
    this.getLength = function(){
      return (queue.length - offset);
    }

    // Returns true if the queue is empty, and false otherwise.
    this.isEmpty = function(){
      return (queue.length == 0);
    }

    /* Enqueues the specified item. The parameter is:
     *
     * item - the item to enqueue
     */
    this.enqueue = function(item){
      queue.push(item);
    }

    /* Enqueues the specified items; faster than calling 'enqueue'
     * repeatedly. The parameter is:
     *
     * items - an array of items to enqueue
     */
    this.enqueueArray = function(items){
      queue.push.apply(queue, items);
    }

    /* Dequeues an item and returns it. If the queue is empty, the value
     * 'undefined' is returned.
     */
    this.dequeue = function(){

      // if the queue is empty, return immediately
      if (queue.length == 0) return undefined;

      // store the item at the front of the queue
      var item = queue[offset];

      // increment the offset and remove the free space if necessary
      if (++ offset * 2 >= queue.length){
        queue  = queue.slice(offset);
        offset = 0;
      }

      // return the dequeued item
      return item;

    }

    /* Returns the item at the front of the queue (without dequeuing it). If the
     * queue is empty then undefined is returned.
     */
    this.peek = function(){
      return (queue.length > 0 ? queue[offset] : undefined);
    }

  }
  /* End Queue.js */

  var vals = new Map();
  var responses = [];
  var sendRspScheduled = false;
  vals.set(1, global);
  var nextValId = -1;
  var unwrapVal = function(valId) {
    if(typeof valId === 'object') {
      if(valId === null) {
        return null;
      } else if(valId.length === 0) {
        return undefined;
      } else {
        return vals.get(valId[0]);
      }
    } else {
      return valId;
    }
  };
  var wrapValWithDefault = function(val, def) {
    switch(typeof val) {
    case 'undefined':
      return [];

    case 'boolean':
    case 'number':
    case 'string':
      return val;

    case 'object':
      if(val === null) {
        return null;
      }
      // Fall through
    default:
      if(def) {
        return [def];
      }
      var valId = nextValId--;
      vals.set(valId, val);
      return [valId];
    }
  };
  var wrapVal = function(val) {
    return wrapValWithDefault(val);
  };
  var doSendRsp = function () {
    if (responses.length > 0) {
      var responses_ = responses;
      responses = [];
      sendRsp(responses_);
    }
  };
  var processSyncCommand = function (msg) {
    var responses_ = responses;
    responses = [];
    return processSyncCommandWithRsp(msg, responses_);
  };
  var appendRsp = function(rsp) {
    responses.push(rsp);
    if (responses.length >= RESPONSE_BUFFER_MAX_SIZE) {
      doSendRsp();
    } else {
      // if (sendRspScheduled === false) {
      //   sendRspScheduled = true;
      //   // Timeout of 0 interferes with batching, and 1 ms is a very high value.
      //   // But because we use TriggerSendRsp, this setTimeout is redundant when the jsaddle is active.
      //   // Without TriggerSendRsp the performance is bad for 0 and terribly bad for 1 ms.
      //   // This is useful only when jsaddle is idle, and its desirable to clear the response pipeline.
      //   setTimeout(function() {
      //     sendRspScheduled = false;
      //     doSendRsp();
      //   }, 1);
      // };
    };
  };
  var sendRspImmediate = function(rsp) {
    responses.push(rsp);
    doSendRsp();
  };
  var result = function(ref, val) {
    vals.set(ref, val);
    appendRsp({
      'tag': 'Result',
      'contents': [
        ref,
        wrapValWithDefault(val, [])
      ]
    });
  };
  var syncRequests = new Queue();
  var getNextSyncRequest = function() {
    if(syncRequests.isEmpty()) {
      syncRequests.enqueueArray(processSyncCommand({
        'tag': 'Continue',
        'contents': []
      }));
    }
    return syncRequests.dequeue();
  };
  var syncDepth = 0;
  var processAllEnqueuedReqs = function() {
    while(!syncRequests.isEmpty()) {
      var tuple = syncRequests.dequeue();
      var syncReq = tuple[1];
      if(syncReq.tag !== 'Req') {
        throw "processAllEnqueuedReqs: syncReq is not SyncBlockReq_Req; this should never happen because Result/Throw should only be sent while a synchronous request is still in progress";
      }
      if (tuple[0] > syncDepth) {
        throw "processAllEnqueuedReqs: queue contains a request for a frame which has exited";

      }
      processSingleReq(syncReq.contents);
    }
  };
  var runSyncCallback = function(callback, that, args) {
    syncDepth++;
    var newReqs = processSyncCommand({
      'tag': 'StartCallback',
      'contents': [
        syncRequests.isEmpty(),
        callback,
        that,
        args
      ]
    });
    if (newReqs.length > 0) {
      if ((newReqs[0][1].tag === 'Throw') && (newReqs[0][0] === syncDepth)) {
        // If we receive the first request as Throw, it means that StartCallback did not happen
        // So throw immediately
        var tuple = newReqs.shift();
        syncRequests.enqueueArray(newReqs);
        syncDepth--;
        throw tuple[1].contents[1];
      } else {
        syncRequests.enqueueArray(newReqs);
      }
    }
    while(true) {
      var tuple = getNextSyncRequest();
      var syncReq = tuple[1];
      switch (syncReq.tag) {
      case 'Req':
        processSingleReq(syncReq.contents);
        break;
      case 'Result':
        syncDepth--;
        if(syncDepth === 0 && !syncRequests.isEmpty()) {
          // Ensure that all remaining sync requests are cleared out in a timely
          // fashion.  Any incoming websocket requests will also run
          // processAllEnqueuedReqs, but it could potentially be an unlimited
          // amount of time before the next websocket request comes in.  We
          // can't process this synchronously because we need to return right
          // now - it's possible the next item in the queue will make use of
          // something we were supposed to produce, so if we run that without
          // returning first, it won't be available
          setTimeout(processAllEnqueuedReqs, 0);
        }
        return syncReq.contents[0];
      case 'Throw':
        // Ensure we are throwing at the right depth
        if (syncDepth !== syncReq.contents[0]) {
          console.error("Received throw for wrong syncDepth: ", syncDepth, syncReq.contents[0]);
          continue;
        };
        var validReqs = [];
        while (!syncRequests.isEmpty()) {
          var tuple = syncRequests.dequeue();
          if (tuple[0] !== syncDepth) {
            validReqs.push(tuple);
          }
        }
        syncRequests.enqueueArray(validReqs);
        syncDepth--;
        throw syncReq.contents[1];
      default:
        throw 'runSyncCallback: unknown request tag ' + JSON.stringify(syncReq.tag);

      }
    }
  };
  var deadTries = new Map();
  var processSingleReq = function(tryReq) {
    // Ignore requests in dead tries
    if(deadTries.has(tryReq.tryId)) {
      if(tryReq.req.tag === 'FinishTry') {
        // FinishTry must be the last req in the try, so we no longer need to
        // keep this around
        deadTries.delete(tryReq.tryId);
      }
      return;
    }

    try {
      var req = tryReq.req;
      switch(req.tag) {
      case 'FreeRef':
        vals.delete(req.contents[0]);
        break;
      case 'NewJson':
        result(req.contents[1], req.contents[0]);
        break;
      case 'GetJson':
        sendRspImmediate({
          'tag': 'GetJson',
          'contents': [
            req.contents[1],
            unwrapVal(req.contents[0])
          ]
        });
        break;
      case 'SyncBlock':
        runSyncCallback(req.contents[0], [], []);
        break;
      case 'NewSyncCallback':
        result(req.contents[1], function() {
          return unwrapVal(runSyncCallback(req.contents[0], wrapVal(this), Array.prototype.slice.call(arguments).map(wrapVal)));
        });
        break;
      case 'NewAsyncCallback':
        var callbackId = req.contents[0];
        result(req.contents[1], function() {
          appendRsp({
            'tag': 'CallAsync',
            'contents': [
              callbackId,
              wrapVal(this),
              Array.prototype.slice.call(arguments).map(wrapVal)
            ]
          });
        });
        break;
      case 'SetProperty':
        unwrapVal(req.contents[2])[unwrapVal(req.contents[0])] = unwrapVal(req.contents[1]);
        break;
      case 'GetProperty':
        result(req.contents[2], unwrapVal(req.contents[1])[unwrapVal(req.contents[0])]);
        break;
      case 'CallAsFunction':
        result(req.contents[3], unwrapVal(req.contents[0]).apply(unwrapVal(req.contents[1]), req.contents[2].map(unwrapVal)));
        break;
      case 'CallAsConstructor':
        result(req.contents[2], new (Function.prototype.bind.apply(unwrapVal(req.contents[0]), [null].concat(req.contents[1].map(unwrapVal)))));
        break;
      case 'FinishTry':
        sendRspImmediate({
          'tag': 'FinishTry',
          'contents': [
            tryReq.tryId,
            { 'Right': [] }
          ]
        });
        break;
      case 'Sync':
        sendRspImmediate({
          'tag': 'Sync',
          'contents': req.contents
        });
        break;
      case 'TriggerSendRsp':
        doSendRsp();
        break;
      default:
        throw 'processSingleReq: unknown request tag ' + JSON.stringify(req.tag);
      }
    } catch(e) {
      deadTries.set(tryReq.tryId, true);
      sendRspImmediate({
        'tag': 'FinishTry',
        'contents': [
          tryReq.tryId,
          { 'Left': wrapVal(e) }
        ]
      });
    }
  };
  var processReq = function(req) {
    processAllEnqueuedReqs();
    processSingleReq(req);
  };
  return {
    processReq: processReq,
    processReqs: function(reqs) {
      for (req of reqs) { processReq(req);}
      doSendRsp();
    }
  };
}


// ghcjs helper functions
function h$isNumber(o) {
    return typeof(o) === 'number';
}

// returns true for null, but not for functions and host objects
function h$isObject(o) {
    return typeof(o) === 'object';
}

function h$isString(o) {
    return typeof(o) === 'string';
}

function h$isSymbol(o) {
    return typeof(o) === 'symbol';
}

function h$isBoolean(o) {
    return typeof(o) === 'boolean';
}

function h$isFunction(o) {
    return typeof(o) === 'function';
}

function h$jsTypeOf(o) {
    var t = typeof(o);
    if(t === 'undefined') return 0;
    if(t === 'object')    return 1;
    if(t === 'boolean')   return 2;
    if(t === 'number')    return 3;
    if(t === 'string')    return 4;
    if(t === 'symbol')    return 5;
    if(t === 'function')  return 6;
    return 7; // other, host object etc
}

function h$jsonTypeOf(o) {
    if (!(o instanceof Object)) {
        if (o == null) {
            return 0;
        } else if (typeof o == 'number') {
            if (h$isInteger(o)) {
                return 1;
            } else {
                return 2;
            }
        } else if (typeof o == 'boolean') {
            return 3;
        } else {
            return 4;
        }
    } else {
        if (Object.prototype.toString.call(o) == '[object Array]') {
            // it's an array
            return 5;
        } else if (!o) {
            // null
            return 0;
        } else {
            // it's an object
            return 6;
        }
    }

}
function h$roundUpToMultipleOf(n,m) {
  var rem = n % m;
  return rem === 0 ? n : n - rem + m;
}

function h$newByteArray(len) {
  var len0 = Math.max(h$roundUpToMultipleOf(len, 8), 8);
  var buf = new ArrayBuffer(len0);
  return { buf: buf
         , len: len
         , i3: new Int32Array(buf)
         , u8: new Uint8Array(buf)
         , u1: new Uint16Array(buf)
         , f3: new Float32Array(buf)
         , f6: new Float64Array(buf)
         , dv: new DataView(buf)
         }
}
function h$wrapBuffer(buf, unalignedOk, offset, length) {
  if(!unalignedOk && offset && offset % 8 !== 0) {
    throw ("h$wrapBuffer: offset not aligned:" + offset);
  }
  if(!buf || !(buf instanceof ArrayBuffer))
    throw "h$wrapBuffer: not an ArrayBuffer"
  if(!offset) { offset = 0; }
  if(!length || length < 0) { length = buf.byteLength - offset; }
  return { buf: buf
         , len: length
         , i3: (offset%4) ? null : new Int32Array(buf, offset, length >> 2)
         , u8: new Uint8Array(buf, offset, length)
         , u1: (offset%2) ? null : new Uint16Array(buf, offset, length >> 1)
         , f3: (offset%4) ? null : new Float32Array(buf, offset, length >> 2)
         , f6: (offset%8) ? null : new Float64Array(buf, offset, length >> 3)
         , dv: new DataView(buf, offset, length)
         };
}
function h$newByteArrayFromBase64String(base64) {
  var bin = window.atob(base64);
  var ba = h$newByteArray(bin.length);
  var u8 = ba.u8;
  for (var i = 0; i < bin.length; i++) {
    u8[i] = bin.charCodeAt(i);
  }
  return ba;
}
function h$byteArrayToBase64String(off, len, ba) {
  var bin = '';
  var u8 = ba.u8;
  var end = off + len;
  for (var i = off; i < end; i++) {
    bin += String.fromCharCode(u8[i]);
  }
  return window.btoa(bin);
}
