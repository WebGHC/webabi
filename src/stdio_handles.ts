import { File, BaseFile } from "browserfs/dist/node/core/file";
import { BaseFileSystem, FileSystemConstructor, BFSCallback, BFSOneArgCallback, BFSThreeArgCallback, FileSystem, FileSystemOptions } from "browserfs/dist/node/core/file_system";
import { FileType } from 'browserfs/dist/node/core/node_fs_stats';
import Stats from 'browserfs/dist/node/core/node_fs_stats';
import { ApiError, ErrorCode } from 'browserfs/dist/node/core/api_error';

export let stdin: File;
export let stdout: File;
export let stderr: File;

class UselessFile extends BaseFile implements File {
  getPos(): number | undefined {
    return undefined;
  }
  stat(cb: BFSCallback<Stats>): void {
    return cb(undefined, new Stats(FileType.FILE, 0));
  }
  statSync(): Stats {
    return new Stats(FileType.FILE, 0)
  }
  close(cb: BFSOneArgCallback): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  closeSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  truncate(len: number, cb: BFSOneArgCallback): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  truncateSync(len: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  write(buffer: Buffer, offset: number, length: number, position: number | null, cb: BFSThreeArgCallback<number, Buffer>): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  read(buffer: Buffer, offset: number, length: number, position: number | null, cb: BFSThreeArgCallback<number, Buffer>): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  readSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

if (typeof self === "undefined") {
  let fs = require("fs");
  class FsFile extends UselessFile implements File {
    fd: number
    constructor(fd: number) {
      super();
      this.fd = fd;
    }
    writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
      return fs.writeSync(this.fd, buffer, offset, length, position);
    }
    readSync(buffer: Buffer, offset: number, length: number, position: number): number {
      return fs.readSync(this.fd, buffer, offset, length, position);
    }
  }
  stdin = new FsFile(0);
  stdout = new FsFile(1);
  stderr = new FsFile(2);
} else {
  class ConsoleFile extends UselessFile implements File {
    log: (msg: string) => void;
    buffer?: Buffer = null;

    constructor(log: (msg: string) => void) {
      super();
      this.log = log;
    }

    writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
      let slicedBuffer = buffer.slice(offset, offset + length);
      let n = slicedBuffer.lastIndexOf("\n");
      if (n < 0) {
        if (this.buffer) {
          this.buffer = Buffer.concat([this.buffer, slicedBuffer]);
        } else {
          this.buffer = slicedBuffer;
        }
      } else {
        let logBuffer = slicedBuffer.slice(0, n);
        if (this.buffer) {
          logBuffer = Buffer.concat([this.buffer, logBuffer]);
        }
        this.log(logBuffer.toString());

        // + 1 to skip the \n
        if (n + 1 < slicedBuffer.length) {
          this.buffer = slicedBuffer.slice(n + 1);
        } else {
          this.buffer = null;
        }
      }
      return length;
    }
  }

  stdin = new UselessFile();
  stdout = new ConsoleFile((msg) => console.log(msg));
  stderr = new ConsoleFile((msg) => console.error(msg));
}
