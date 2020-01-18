import { BaseFileSystem, BFSCallback, FileSystem, FileSystemOptions, BFSOneArgCallback, BFSThreeArgCallback
       } from "@marionebl/browserfs/dist/node/core/file_system";
import Stats from '@marionebl/browserfs/dist/node/core/node_fs_stats';
import { BaseFile, File } from "@marionebl/browserfs/dist/node/core/file";
import { FileFlag } from "@marionebl/browserfs/dist/node/core/file_flag";
import { ApiError } from '@marionebl/browserfs/dist/node/core/api_error';
import { Device } from './DeviceFileSystem';

export class JSaddleDevice implements Device {
  private _file: JSaddleDeviceFile
  constructor(
    jsaddleListener: MessagePort,
    jsaddleMsgBufArray: Uint8Array,
    jsaddleMsgBufArray32: Uint32Array,
    jsaddleMsgBufArrayInt32: Int32Array
  ) {
    this._file = new JSaddleDeviceFile(this, jsaddleListener
                                  , jsaddleMsgBufArray, jsaddleMsgBufArray32, jsaddleMsgBufArrayInt32);
  }

  public open(flag: FileFlag): File {
    return this._file;
  }
  public stat(isLstat: boolean | null): Stats {
    // S_IFCHR    0020000   character device
    // S_IFDIR 0040000 Directory
    return new Stats(0x2000, 0, 0x2000);
  }
}

export class JSaddleDeviceFile extends BaseFile implements File {
  constructor(
    private _Device: JSaddleDevice,
    private _jsaddleListener: MessagePort,
    private _jsaddleMsgBufArray: Uint8Array,
    private _jsaddleMsgBufArray32: Uint32Array,
    private _jsaddleMsgBufArrayInt32: Int32Array) {
    super();
  }
  public getPos(): number | undefined {
    return undefined;
  }
  public close(cb: BFSOneArgCallback): void {
    let err: ApiError | null = null;
    try {
      this.closeSync();
    } catch (e) {
      err = e;
    } finally {
      cb(err);
    }
  }
  public closeSync(): void {
    // NOP.
  }
  public truncate(len: number, cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public truncateSync(len: number): void {
    // NOP.
  }
  public stat(cb: BFSCallback<Stats>): void {
    // NOP.
    cb(null);
  }
  public statSync(): Stats {
    return this._Device.stat(null);
    // NOP.
  }
  public datasync(cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public datasyncSync(): void {
    // NOP.
  }
  public write(buffer: Buffer, offset: number, length: number, position: number, cb: BFSThreeArgCallback<number, Buffer>): void {
    try {
      cb(null, this.writeSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }
  public writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
    var a = new Uint8Array(buffer.slice(offset, offset + length));
    var b = a.buffer;
    this._jsaddleListener.postMessage({type: 'write', buffer: b}, [b]);
    return length;
  }
  public read(buffer: Buffer, offset: number, length: number, position: number, cb: BFSThreeArgCallback<number, Buffer>): void {
    try {
      cb(null, this.readSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }
  public readSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
    var bytes_read = 0;
    var lockValue = Atomics.compareExchange(this._jsaddleMsgBufArrayInt32, 0, 0, 2);
    if (lockValue === 1) { // Locked by appendMsgToSharedBuf
      Atomics.wait(this._jsaddleMsgBufArrayInt32, 0, 0, 50);
      bytes_read = this.readSync(buffer, offset, length, position);
    } else {
      var releaseLock = true;
      var payloadSize = this._jsaddleMsgBufArray32[1];
      if (payloadSize > 0) {
        var startCopyFrom = 4;
        var prependSizeBytes = 4;
        if (lockValue === 3) { // continue append of data
          startCopyFrom = 8;
          prependSizeBytes = 0;
        }
        if ((prependSizeBytes + payloadSize) > length) {
          bytes_read = length;
          releaseLock = false;
        } else {
          bytes_read = prependSizeBytes + payloadSize;
        }
        buffer.set(this._jsaddleMsgBufArray.subarray(startCopyFrom, startCopyFrom + bytes_read), offset);

        // Shift the remaining contents, and set size
        if ((prependSizeBytes + payloadSize) > length) {
          this._jsaddleMsgBufArray.copyWithin(8, startCopyFrom + length, payloadSize + 8);
        }
        this._jsaddleMsgBufArray32[1] = (prependSizeBytes + payloadSize) - bytes_read;
      }
      if (releaseLock) {
        // Release the lock
        this._jsaddleMsgBufArrayInt32[0] = 0;
        // @ts-ignore
        Atomics.notify(this._jsaddleMsgBufArrayInt32, 0);
      } else {
        // Keep the lock, and continue append of data on next readSync call
        this._jsaddleMsgBufArrayInt32[0] = 3;
      }
    }
    return bytes_read;
  }
  public sync(cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public syncSync(): void {
    // NOP.
  }
  public chown(uid: number, gid: number, cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public chownSync(uid: number, gid: number): void {
    // NOP.
  }
  public chmod(mode: number, cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public chmodSync(mode: number): void {
    // NOP.
  }
  public utimes(atime: Date, mtime: Date, cb: BFSOneArgCallback): void {
    // NOP.
    cb();
  }
  public utimesSync(atime: Date, mtime: Date): void {
    // NOP.
  }
}
