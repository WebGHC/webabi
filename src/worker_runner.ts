import { configureFileSystem, Process } from "./index";
import { connectParent } from "./worker";

connectParent({ onMessage: async msg => {
  const fs = await configureFileSystem({ devices: {} });
  (await Process.instantiateProcess(fs, msg)).start();
}});
