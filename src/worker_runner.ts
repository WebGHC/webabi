import { configureFileSystem, Process } from "./index";
import { connectParent } from "./worker";
import { JSaddleDevice } from "./JSaddleDevice";

connectParent({ onMessage: async msg => {
  const jsaddleDevice = new JSaddleDevice(
    msg.data.jsaddleListener,
    msg.data.jsaddleMsgBufArray,
    msg.data.jsaddleMsgBufArray32);
  const fs = await configureFileSystem({ devices: { ["jsaddle_inout"]: jsaddleDevice } });
  (await Process.instantiateProcess(fs, msg.data.url)).start();
}});
