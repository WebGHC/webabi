import { Device, configureFileSystem, BFSCallback,
         Stats, File, FileFlag, FS, ApiError,
         ErrorCode, asyncRead, asyncWrite } from "webabi-kernel";

class JSaddleDevice implements Device {
  async open(flag: FileFlag): Promise<File> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  async stat(isLstat: boolean | null): Promise<Stats> {
    throw new ApiError(ErrorCode.ENOTSUP);
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
