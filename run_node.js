var args = process.argv.splice(process.execArgv.length + 2);

if (args.length == 0) {
  console.log('Usage: node run_node.js <wasm-executable-name>');
} else {
  var wasmjs = require('./wasm.js');

  var execName = args[0];

  wasmjs.wasmExecve (execName);

  console.log('Done');
}

