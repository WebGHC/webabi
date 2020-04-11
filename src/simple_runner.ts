import { configureFileSystem, Process } from "./index";
//import { connectParent } from "./worker";
//import { JSaddleDevice } from "./JSaddleDevice";

export function startWasm (url, cont) {
  configureFileSystem({ devices: {} })
    .then (fs => { return Process.instantiateProcess(fs, url);})
    .then (p => {cont(p);});
};

export { startWasm as start_wasm }
export const someval = 55;

// @ts-ignore
startWasm("reflex-todomvc", jsaddleDriver);
