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
  open(flag: FileFlag, cb: BFSCallback<File>): void;
  stat(isLstat: boolean | null, cb: BFSCallback<Stats>): void;
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
      return this.options.devices[p].open(flag, cb);
    } else {
      return cb(ApiError.ENOENT(p));
    }
  }
  public stat(p: string, isLstat: boolean | null, cb: BFSCallback<Stats>): void {
    if (this.options.devices.hasOwnProperty(p)) {
      return this.options.devices[p].stat(isLstat, cb);
    } else {
      return cb(ApiError.ENOENT(p));
    }
  }
}

export function configureFileSystem(devices: { [name: string]: Device }, cb: BFSCallback<FS>): void {
  DeviceFileSystem.Create({ devices: devices }, (e, dfs) => {
    if (e) {
      cb(e);
      return;
    }
    MountableFileSystem.Create({
      "/dev": dfs
    }, (e, mfs) => {
      if (e) {
        cb(e);
        return
      }

      const fs = new FS();
      fs.initialize(mfs);

      const fdMap: {[id: number]: File} = (fs as any).fdMap;
      fdMap[0] = handles.stdin;
      fdMap[1] = handles.stdout;
      fdMap[2] = handles.stderr;

      cb(undefined, fs);
    });
  });
}

// Re-export for device implementors
export { BFSCallback, Stats, File, FileFlag };
