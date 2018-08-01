import { Device, configureFileSystem, BFSCallback, Stats, File, FileFlag } from "webabi-kernel";

class JSaddleDevice implements Device {
  open(flag: FileFlag, cb: BFSCallback<File>): void {
  }
  stat(isLstat: boolean | null, cb: BFSCallback<Stats>): void {
  }
}

configureFileSystem({ "/jsaddle": new JSaddleDevice() }, (err, fs) => {
  console.log(err);
  let buf = Buffer.from("hi\n");
  fs.write(1, buf, 0, buf.length, null, () => {});
});
