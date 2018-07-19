var args = process.argv.splice(process.execArgv.length + 2);

if (args.length == 0) {
  console.log('Usage: node run_node.js <wasm-executable-name> (--debug|--warn)');
} else {
  var wasmjs = require('./wasm.js');

  var sysCalls = false;
  var warnings = false;
  var execName = 'args-error';
  for (let j = 0; j < args.length; j++) {
    var s = args[j];
    if (s.startsWith('--')) {
      if (s == '--debug') {
        sysCalls = true;
        warnings = true;
      }
      if (s == '--warn') {
        warnings = true;
      }
    } else {
      execName = s;
    }
    console.log(j + ' -> ' + (process.argv[j]));
  }

  wasmjs.wasmExecve(execName, sysCalls, warnings);
}
