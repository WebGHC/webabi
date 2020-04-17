// JSaddle wasm JS interface for mainthread runtime architecture

var dec = new TextDecoder();
var enc = new TextEncoder();

// Should be run after process initialization
function jsaddleDriver(wasm_process) {
  //
  wasm_process.start([], []);

  var pendingAsyncMessages = [];

  // Store msgs in JSON
  function sendAPI (msg) {
    pendingAsyncMessages.push(msg);
  }

  var sendSync = function (msg) {
    var str = JSON.stringify([msg]);
    var retStr = wasm_process.processResult(true, str);
    return ((JSON.parse(retStr))[0]);
  };

  var jsaddleHandler = function (str) {
    if (str !== "") {
      var batches = JSON.parse(str);
      for (var i = 0; i < batches.length; i++) {
        runBatchWrapper(batches[i], sendAPI, sendSync);
      }
    }
  };

  // get the initial command and run it
  jsaddleHandler(wasm_process.processResult(false, ""));
  // process async results
  window.setInterval( function() {
    var doOneCall = function () {
      var results = pendingAsyncMessages;
      pendingAsyncMessages = [];
      jsaddleHandler(wasm_process.processResult(false, JSON.stringify(results)));
    };
    doOneCall();
    while (pendingAsyncMessages.length > 0) {
      // Process all pending messages
      doOneCall();
    }
  }, 100);
}
