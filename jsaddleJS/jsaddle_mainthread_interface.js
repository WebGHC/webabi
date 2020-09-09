// JSaddle wasm JS interface for mainthread runtime architecture

var dec = new TextDecoder();
var enc = new TextEncoder();

// Should be run after process initialization
function jsaddleDriver(wasm_process) {
  //
  wasm_process.start([], []);

  var pendingAsyncResponses = [];
  var pendingAsyncRequests = [];

  var sendScheduled = false;
  var doOneSend = function () {
    var rsps = pendingAsyncResponses;
    pendingAsyncResponses = [];
    // console.log(rsps);
    var newReqs = wasm_process.processResult(false, JSON.stringify(rsps));
    if (newReqs.length > 0) {
      // console.log(newReqs);
      pendingAsyncRequests.push.apply(pendingAsyncRequests, JSON.parse(newReqs));
    }
    sendScheduled = false;
  };

  var sendRsp = function (msgs) {
    pendingAsyncResponses.push.apply(pendingAsyncResponses, msgs);
    if (sendScheduled == false) {
      sendScheduled = true;
      window.setTimeout(doOneSend, 1);
    }
  };

  var processSyncCommand = function (msg) {
    var str = JSON.stringify(msg);
    // console.log("processSyncCommand", msg);
    var retStr = wasm_process.processResult(true, str);
    return (JSON.parse(retStr));
  };

  var core = jsaddleCoreJs(window, sendRsp, processSyncCommand, 20);

  // get the initial command and run it
  var initReqs = wasm_process.processResult(false, "");
  if (initReqs.length == 0) {
    throw "Did not receive initReqs";
  }
  core.processReqs(JSON.parse(initReqs));

  // process async rsps
  window.setTimeout( function runOuter() {
    var doOneIter = function () {
      var reqs = pendingAsyncRequests;
      pendingAsyncRequests = [];
      core.processReqs(reqs);
    };
    while (pendingAsyncRequests.length > 0) {
      // Process all pending messages
      doOneIter();
      doOneSend();
    }
    doOneSend();
    window.setTimeout(runOuter, 10);
  }, 0);
}
