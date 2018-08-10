import FS from "browserfs/dist/node/core/FS";
import { makeWorker, PostMessage, OnMessage } from "./worker";

export default class Kernel {
  fs: FS;
  constructor(fs: FS) {
    this.fs = fs;
  };
}
