import { Device, configureFileSystem, BFSCallback, Stats, File, FileFlag } from "webabi-kernel";

class JSaddleDevice implements Device {
  open(flag: FileFlag, cb: BFSCallback<File>): void {
  }
  stat(isLstat: boolean | null, cb: BFSCallback<Stats>): void {
  }
}

configureFileSystem({ "/jsaddle": new JSaddleDevice() }, (err, fs) => {
  console.log(err);
  let buf = Buffer.from("foo\n");
  fs.write(1, buf, 0, buf.length, null, () => {
    fs.read(0, buf, 0, 4, null, (err, n, buf) => {
      console.log({ err: err, n: n, buf: buf && buf.toString() });
    });
  });
});
