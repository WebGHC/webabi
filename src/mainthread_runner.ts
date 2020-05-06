import { configureFileSystem, Process } from "./index";

export function startWasm (url, jsaddle_cont) {
  configureFileSystem({ devices: {} })
    .then (fs => { return Process.instantiateProcess(fs, false, url);})
    .then (p => {jsaddle_cont(p);});
};

// Somehow this export is not working
// So instead specify the variables WASM_URL_FOR_MAINTHREAD_RUNNER_JS and jsaddleDriver
// in the global scope before importing this
export { startWasm as start_wasm }

// @ts-ignore
startWasm(WASM_URL_FOR_MAINTHREAD_RUNNER_JS, jsaddleDriver);
