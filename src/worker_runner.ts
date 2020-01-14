import { configureFileSystem, Process } from "./index";
import { connectParent } from "./worker";
import { JSaddleDevice } from "./JSaddleDevice";

connectParent({ onMessage: async msg1 => {
  // TODO
  let msg = await msg1;
  console.log(msg);
  const jsaddleDevice = new JSaddleDevice(
    msg.jsaddleVals.jsaddleListener,
    msg.jsaddleVals.jsaddleMsgBufArray,
    msg.jsaddleVals.jsaddleMsgBufArray32,
    msg.jsaddleVals.jsaddleMsgBufArrayInt32);
  const fs = await configureFileSystem({ devices: { ["/jsaddle_inout"]: jsaddleDevice } });
  (await Process.instantiateProcess(fs, msg.url)).start([],[]);
}});
