import { configureFileSystem, Process } from "./index";
import { connectParent } from "./worker";
import { JSaddleDevice } from "./JSaddleDevice";
const fs = configureFileSystem();

var g_objInstance = null;

connectParent({ onMessage: async msg1 => {
  let msg = await msg1;
  console.log(msg);
  if (msg.url) {
    let inst = Process.instantiateProcess(fs, msg.url, msg.jsaddleVals.jsaddleChannelPort);
    inst.then(obj => {
      g_objInstance = obj;
      g_objInstance.start([],[]);
      var emptyMsg = new ArrayBuffer(0);
      g_objInstance.runStep({data : emptyMsg});
    });
  } else {
    g_objInstance.runStep(msg);
  }
}});
