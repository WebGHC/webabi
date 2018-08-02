import MountableFileSystem from "browserfs/dist/node/backend/MountableFileSystem";
import * as handles from "./stdio_handles";
import { BaseFileSystem, FileSystemConstructor, BFSCallback,
         BFSOneArgCallback, BFSThreeArgCallback, FileSystem,
         FileSystemOptions } from "browserfs/dist/node/core/file_system";
import { FileType } from 'browserfs/dist/node/core/node_fs_stats';
import Stats from 'browserfs/dist/node/core/node_fs_stats';
import { File } from "browserfs/dist/node/core/file";
import { FileFlag } from "browserfs/dist/node/core/file_flag";
import { ApiError, ErrorCode } from 'browserfs/dist/node/core/api_error';
import FS from "browserfs/dist/node/core/FS";

export interface Device {
  open(flag: FileFlag): Promise<File>;
  stat(isLstat: boolean | null): Promise<Stats>;
}

export interface DeviceFileSystemOptions {
  devices: {[name: string]: Device};
}

export class DeviceFileSystem extends BaseFileSystem implements FileSystem {
  public static readonly Name = "DeviceFileSystem";
  public static readonly Options: FileSystemOptions = {};

  public static Create(opts: DeviceFileSystemOptions, cb: BFSCallback<DeviceFileSystem>): void {
    return cb(null, new DeviceFileSystem(opts));
  }

  public static isAvailable(): boolean {
    return true;
  }

  options: DeviceFileSystemOptions;

  constructor(options: DeviceFileSystemOptions) {
    super();
    this.options = options;
  }

  public getName() {
    return "DeviceFileSystem";
  }
  public isReadOnly() {
    return false;
  }
  public supportsProps() {
    return false;
  }
  public supportsSynch() {
    return false;
  }

  public openFile(p: string, flag: FileFlag, cb: BFSCallback<File>): void {
    if (this.options.devices.hasOwnProperty(p)) {
      this.options.devices[p].open(flag).then(f => cb(undefined, f), e => cb(e));
    } else {
      cb(ApiError.ENOENT(p));
    }
  }
  public stat(p: string, isLstat: boolean | null, cb: BFSCallback<Stats>): void {
    if (this.options.devices.hasOwnProperty(p)) {
      this.options.devices[p].stat(isLstat).then(s => cb(undefined, s), e => cb(e));
    } else {
      cb(ApiError.ENOENT(p));
    }
  }
}

export async function configureFileSystem(devices: { [name: string]: Device }): Promise<FS> {
  const dfs = await new Promise<DeviceFileSystem>((resolve, reject) => {
    DeviceFileSystem.Create({ devices: devices }, (e, dfs) => e ? reject(e) : resolve(dfs))
  });
  const mfs = await new Promise<MountableFileSystem>((resolve, reject) => {
    MountableFileSystem.Create({
      "/dev": dfs
    }, (e, mfs) => e ? reject(e) : resolve(mfs));
  });

  const fs = new FS();
  fs.initialize(mfs);

  const fdMap: {[id: number]: File} = (fs as any).fdMap;
  fdMap[0] = handles.stdin;
  fdMap[1] = handles.stdout;
  fdMap[2] = handles.stderr;

  return fs;
}

export async function asyncRead(fs: FS, fd: number, buffer: Buffer, offset: number, length: number, position: number | null)
: Promise<{ byteLength: number, buffer: Buffer }> {
  return new Promise<{ byteLength: number, buffer: Buffer }>((resolve, reject) => {
    fs.read(fd, buffer, offset, length, position,
            (err, n, buf) => err ? reject(err) : resolve({ byteLength: n, buffer: buf }));
  });
}

export async function asyncWrite(fs: FS, fd: number, buffer: Buffer, offset: number, length: number, position: number | null)
: Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.write(fd, buffer, offset, length, position, e => e ? reject(e) : resolve())
  });
}

// Re-export for device implementors
export { BFSCallback, Stats, File, FileFlag, FS, ApiError, ErrorCode };
