var dec = new TextDecoder();
var enc = new TextEncoder();


// initState of JSaddle JS
var jsaddle_values = new Map();
var jsaddle_free = new Map();
jsaddle_values.set(0, null);
jsaddle_values.set(1, undefined);
jsaddle_values.set(2, false);
jsaddle_values.set(3, true);
jsaddle_values.set(4, window);
var jsaddle_index = 100;
var expectedBatch = 1;
var lastResults = [0, {"tag": "Success", "contents": [[], []]}];
var inCallback = 0;
var asyncBatch = null;

// runBatch :: (ByteString -> ByteString) -> Maybe (ByteString -> ByteString) -> ByteString
function jsaddleHandler(msg) {
  var m = dec.decode(msg);
  var batch = JSON.parse(m);
  var runBatch = function (firstBatch, initialSyncDepth) {
    var processBatch = function(timestamp) {
      var batch = firstBatch;
      var callbacksToFree = [];
      var results = [];
      inCallback++;
      try {
        var syncDepth = initialSyncDepth || 0;
        for(;;){
          if(batch[2] === expectedBatch) {
            expectedBatch++;
            var nCommandsLength = batch[0].length;
            for (var nCommand = 0; nCommand != nCommandsLength; nCommand++) {
              var cmd = batch[0][nCommand];
              if (cmd.Left) {
                var d = cmd.Left;
                switch (d.tag) {
                case "FreeRef":
                  var refsToFree = jsaddle_free.get(d.contents[0]) || [];
                  refsToFree.push(d.contents[1]);
                  jsaddle_free.set(d.contents[0], refsToFree);
                  break;
                case "FreeRefs":
                  var refsToFree = jsaddle_free.get(d.contents) || [];
                  for(var nRef = 0; nRef != refsToFree.length; nRef++)
                    jsaddle_values.delete(refsToFree[nRef]);
                  jsaddle_free.delete(d.contents);
                  break;
                case "SetPropertyByName":
                  jsaddle_values.get(d.contents[0])[d.contents[1]]=jsaddle_values.get(d.contents[2]);
                  break;
                case "SetPropertyAtIndex":
                  jsaddle_values.get(d.contents[0])[d.contents[1]]=jsaddle_values.get(d.contents[2]);
                  break;
                case "EvaluateScript":
                  var n = d.contents[1];
                  jsaddle_values.set(n, eval(d.contents[0]));
                  break;
                case "StringToValue":
                  var n = d.contents[1];
                  jsaddle_values.set(n, d.contents[0]);
                  break;
                case "JSONValueToValue":
                  var n = d.contents[1];
                  jsaddle_values.set(n, d.contents[0]);
                  break;
                case "GetPropertyByName":
                  var n = d.contents[2];
                  jsaddle_values.set(n, jsaddle_values.get(d.contents[0])[d.contents[1]]);
                  break;
                case "GetPropertyAtIndex":
                  var n = d.contents[2];
                  jsaddle_values.set(n, jsaddle_values.get(d.contents[0])[d.contents[1]]);
                  break;
                case "NumberToValue":
                  var n = d.contents[1];
                  jsaddle_values.set(n, d.contents[0]);
                  break;
                case "NewEmptyObject":
                  var n = d.contents;
                  jsaddle_values.set(n, {});
                  break;
                case "NewAsyncCallback":
                  (function() {
                    var nFunction = d.contents;
                    var func = function() {
                      var nFunctionInFunc = ++jsaddle_index;
                      jsaddle_values.set(nFunctionInFunc, func);
                      var nThis = ++jsaddle_index;
                      jsaddle_values.set(nThis, this);
                      var args = [];
                      for (var i = 0; i != arguments.length; i++) {
                        var nArg = ++jsaddle_index;
                        jsaddle_values.set(nArg, arguments[i]);
                        args[i] = nArg;
                      }
                      sendAPI ({"tag": "Callback", "contents": [lastResults[0], lastResults[1], nFunction, nFunctionInFunc, nThis, args]});
                    };
                    jsaddle_values.set(nFunction, func);
                  })();
                  break;
                case "NewSyncCallback":
                  (function() {
                    var nFunction = d.contents;
                    var func = function() {
                      var nFunctionInFunc = ++jsaddle_index;
                      jsaddle_values.set(nFunctionInFunc, func);
                      var nThis = ++jsaddle_index;
                      jsaddle_values.set(nThis, this);
                      var args = [];
                      for (var i = 0; i != arguments.length; i++) {
                        var nArg = ++jsaddle_index;
                        jsaddle_values.set(nArg, arguments[i]);
                        args[i] = nArg;
                      }
                      sendAPI ({"tag": "Callback", "contents": [lastResults[0], lastResults[1], nFunction, nFunctionInFunc, nThis, args]});
                    };
                    jsaddle_values.set(nFunction, func);
                  })();
                  break;
                case "FreeCallback":
                  callbacksToFree.push(d.contents);
                  break;
                case "CallAsFunction":
                  var n = d.contents[3];
                  jsaddle_values.set(n,
                                     jsaddle_values.get(d.contents[0]).apply(jsaddle_values.get(d.contents[1]),
                                                                             d.contents[2].map(function(arg){return jsaddle_values.get(arg);})));
                  break;
                case "CallAsConstructor":
                  var n = d.contents[2];
                  var r;
                  var f = jsaddle_values.get(d.contents[0]);
                  var a = d.contents[1].map(function(arg){return jsaddle_values.get(arg);});
                  switch(a.length) {
                  case 0 : r = new f(); break;
                  case 1 : r = new f(a[0]); break;
                  case 2 : r = new f(a[0],a[1]); break;
                  case 3 : r = new f(a[0],a[1],a[2]); break;
                  case 4 : r = new f(a[0],a[1],a[2],a[3]); break;
                  case 5 : r = new f(a[0],a[1],a[2],a[3],a[4]); break;
                  case 6 : r = new f(a[0],a[1],a[2],a[3],a[4],a[5]); break;
                  case 7 : r = new f(a[0],a[1],a[2],a[3],a[4],a[5],a[6]); break;
                  default:
                    var ret;
                    var temp = function() {
                      ret = f.apply(this, a);
                    };
                    temp.prototype = f.prototype;
                    var i = new temp();
                    if(ret instanceof Object)
                      r = ret;
                    else {
                      i.constructor = f;
                      r = i;
                    }
                  }
                  jsaddle_values.set(n, r);
                  break;
                case "NewArray":
                  var n = d.contents[1];
                  jsaddle_values.set(n, d.contents[0].map(function(v){return jsaddle_values.get(v);}));
                  break;
                case "SyncWithAnimationFrame":
                  var n = d.contents;
                  jsaddle_values.set(n, timestamp);
                  break;
                case "StartSyncBlock":
                  syncDepth++;
                  break;
                case "EndSyncBlock":
                  syncDepth--;
                  break;
                default:
                  sendAPI ({"tag": "ProtocolError", "contents": e.data});
                  return;
                }
              } else {
                var d = cmd.Right;
                switch (d.tag) {
                case "ValueToString":
                  var val = jsaddle_values.get(d.contents);
                  var s = val === null ? "null" : val === undefined ? "undefined" : val.toString();
                  results.push({"tag": "ValueToStringResult", "contents": s});
                  break;
                case "ValueToBool":
                  results.push({"tag": "ValueToBoolResult", "contents": jsaddle_values.get(d.contents) ? true : false});
                  break;
                case "ValueToNumber":
                  results.push({"tag": "ValueToNumberResult", "contents": Number(jsaddle_values.get(d.contents))});
                  break;
                case "ValueToJSON":
                  var s = jsaddle_values.get(d.contents) === undefined ? "" : JSON.stringify(jsaddle_values.get(d.contents));
                  results.push({"tag": "ValueToJSONResult", "contents": s});
                  break;
                case "ValueToJSONValue":
                  results.push({"tag": "ValueToJSONValueResult", "contents": jsaddle_values.get(d.contents)});
                  break;
                case "DeRefVal":
                  var n = d.contents;
                  var v = jsaddle_values.get(n);
                  var c = (v === null           ) ? [0, ""] :
                      (v === undefined      ) ? [1, ""] :
                      (v === false          ) ? [2, ""] :
                      (v === true           ) ? [3, ""] :
                      (typeof v === "number") ? [-1, v.toString()] :
                      (typeof v === "string") ? [-2, v]
                      : [-3, ""];
                  results.push({"tag": "DeRefValResult", "contents": c});
                  break;
                case "IsNull":
                  results.push({"tag": "IsNullResult", "contents": jsaddle_values.get(d.contents) === null});
                  break;
                case "IsUndefined":
                  results.push({"tag": "IsUndefinedResult", "contents": jsaddle_values.get(d.contents) === undefined});
                  break;
                case "InstanceOf":
                  results.push({"tag": "InstanceOfResult", "contents": jsaddle_values.get(d.contents[0]) instanceof jsaddle_values.get(d.contents[1])});
                  break;
                case "StrictEqual":
                  results.push({"tag": "StrictEqualResult", "contents": jsaddle_values.get(d.contents[0]) === jsaddle_values.get(d.contents[1])});
                  break;
                case "PropertyNames":
                  var result = [];
                  for (name in jsaddle_values.get(d.contents)) { result.push(name); }
                  results.push({"tag": "PropertyNamesResult", "contents": result});
                  break;
                case "Sync":
                  results.push({"tag": "SyncResult", "contents": []});
                  break;
                default:
                  results.push({"tag": "ProtocolError", "contents": e.data});
                }
              }
            }
            if(syncDepth <= 0) {
              lastResults = [batch[2], {"tag": "Success", "contents": [callbacksToFree, results]}];
              sendAPI ({"tag": "BatchResults", "contents": [lastResults[0], lastResults[1]]});
              break;
            } else {
              sendAPI ({"tag": "BatchResults", "contents": [batch[2], {"tag": "Success", "contents": [callbacksToFree, results]}]});
              break;
            }
          } else {
            if(syncDepth <= 0) {
              break;
            } else {
              sendAPI ({"tag": "Duplicate", "contents": [batch[2], expectedBatch]});
              break;
            }
          }
        }
      }
      catch (err) {
        console.log(err);
        var n = ++jsaddle_index;
        jsaddle_values.set(n, err);
        sendAPI ({"tag": "BatchResults", "contents": [batch[2], {"tag": "Failure", "contents": [callbacksToFree, results, n]}]});
      }
      if(inCallback == 1) {
        while(asyncBatch !== null) {
          var b = asyncBatch;
          asyncBatch = null;
          if(b[2] == expectedBatch) runBatch(b);
        }
      }
      inCallback--;
    };
    if(batch[1] && (initialSyncDepth || 0) === 0) {
      window.requestAnimationFrame(processBatch);
    }
    else {
      processBatch(window.performance ? window.performance.now() : null);
    }
  };

  for (i = 0; i < batch.length; i++) {
    runBatch(batch[i]);
  }
}

var channel = new MessageChannel();
channel.port1.onmessage = jsaddleHandlerMsgs;


function jsaddleHandlerMsgs (msg) {
  jsaddleHandler(msg.data.buffer);
}
var g_worker = null;
function sendAPI (msg) {
  var str = JSON.stringify(msg);
  var a = enc.encode(str);
  var size = a.length;
  var b = new ArrayBuffer(size);
  const uint8 = new Uint8Array(b);
  uint8.set(a, 0);
  // non-blocking
  console.log("sendAPI", size);
  g_worker.postMessage({data : b}, [b]);
}

function jsaddleJsInit(worker) {
  g_worker = worker;
  return {
    jsaddleChannelPort: channel.port2,
  };
}
