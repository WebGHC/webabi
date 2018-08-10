import { Device, configureKernel, BFSCallback,
         Stats, File, FileFlag, FS, ApiError,
         ErrorCode, asyncRead, asyncWrite } from "webabi-kernel";
import { makeWorker, PostMessage, OnMessage } from "webabi-kernel/dist/worker";

class JSaddleDevice implements Device {
  async open(flag: FileFlag): Promise<File> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  async stat(isLstat: boolean | null): Promise<Stats> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

async function main() {
  let kernel = await configureKernel({ "/jsaddle": new JSaddleDevice() });
  let fs = kernel.fs;
  let buf = Buffer.from("foo\n");
  await asyncWrite(fs, 1, buf, 0, buf.length, null);
  const { byteLength } = await asyncRead(fs, 0, buf, 0, buf.length, null);
  console.log({ byteLength: byteLength, buffer: buf.toString() });

  console.log("working");
  let worker: PostMessage;
  worker = await makeWorker("./exec/build/main.js", {
    onMessage: msg => {
      console.log(msg);
      worker.close();
    }
  });
  worker.postMessage("foo");
}

main().catch(e => {
  console.error("Error: ", e);
});
