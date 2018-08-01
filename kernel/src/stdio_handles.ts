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

if (process && !(process as any).browser) {
  interface Request {
    buffer: Buffer;
    offset: number;
    length: number;
    cb: BFSThreeArgCallback<number, Buffer>;
  }
  class ReadWriteStreamFile extends UselessFile implements File {
    stream: NodeJS.ReadWriteStream;
    requests: [Request] = <[Request]> [];
    leftover?: Buffer = null;

    constructor(stream: NodeJS.ReadWriteStream) {
      super();
      this.stream = stream;
      this.stream.pause();
      this.stream.on("error", (err) => {
        const reqs = this.requests;
        this.requests = <[Request]> [];
        for (const req of reqs) {
          req.cb(err, undefined, undefined);
        }
      });
      this.stream.on("data", (buf) => {
        this.stream.pause();
        if (this.leftover) {
          buf = Buffer.concat([this.leftover, buf]);
          this.leftover = null;
        }
        this.onData(buf);
      });
    }

    onData(buf: Buffer): void {
      const reqs = this.requests;
      this.requests = <[Request]> [];
      let nextBuf: Buffer | null = null;
      for (const req of reqs) {
        if (buf.length > req.length) {
          nextBuf = buf.slice(req.length);
          buf = buf.slice(0, req.length);
        } else {
          nextBuf = null;
        }

        const copied = buf.copy(req.buffer, req.offset);
        req.cb(undefined, copied, req.buffer);

        buf = nextBuf;
      }

      if (nextBuf) {
        // nextBuf may still have the old leftover underlying it.
        // Use Buffer.from to avoid retaining the entire history.
        this.leftover = Buffer.from(nextBuf);
      }
    };
    close(cb: BFSOneArgCallback): void {
      this.stream.end(cb);
    }
    write(buffer: Buffer, offset: number, length: number, position: number | null, cb: BFSThreeArgCallback<number, Buffer>): void {
      this.stream.write(buffer.slice(offset, offset + length), (err) => {
        if (err) {
          cb(err);
        } else {
          cb(undefined, length, buffer);
        }
      });
    }
    read(buffer: Buffer, offset: number, length: number, position: number | null, cb: BFSThreeArgCallback<number, Buffer>): void {
      this.stream.resume();
      this.requests.push({
        buffer: buffer,
        offset: offset,
        length: length,
        cb: cb
      });
    }
  }

  stdin = new ReadWriteStreamFile(process.stdin);
  stdout = new ReadWriteStreamFile(process.stdout);
  stderr = new ReadWriteStreamFile(process.stderr);
} else {
  class ConsoleFile extends UselessFile implements File {
    log: (msg: string) => void;
    buffer?: Buffer = null;

    constructor(log: (msg: string) => void) {
      super();
      this.log = log;
    }

    write(buffer: Buffer, offset: number, length: number, position: number | null, cb: BFSThreeArgCallback<number, Buffer>): void {
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
      cb(undefined, length, buffer);
    }
  }

  stdin = new UselessFile();
  stdout = new ConsoleFile((msg) => console.log(msg));
  stderr = new ConsoleFile((msg) => console.error(msg));
}
