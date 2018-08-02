import { Device, configureFileSystem, BFSCallback, Stats, File, FileFlag, FS, asyncRead, asyncWrite } from "webabi-kernel";

class JSaddleDevice implements Device {
  open(flag: FileFlag, cb: BFSCallback<File>): void {
  }
  stat(isLstat: boolean | null, cb: BFSCallback<Stats>): void {
  }
}

async function main() {
  let fs = await configureFileSystem({ "/jsaddle": new JSaddleDevice() });
  let buf = Buffer.from("foo\n");
  await asyncWrite(fs, 1, buf, 0, buf.length, null);
  const { byteLength } = await asyncRead(fs, 0, buf, 0, buf.length, null);
  console.log({ byteLength: byteLength, buffer: buf.toString() });
}

main().catch(e => {
  console.error("Error: ", e);
});
