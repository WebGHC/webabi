import { BaseFileSystem, BFSCallback, FileSystem, FileSystemOptions
       } from "browserfs/dist/node/core/file_system";
import Stats from 'browserfs/dist/node/core/node_fs_stats';
import { File } from "browserfs/dist/node/core/file";
import { FileFlag } from "browserfs/dist/node/core/file_flag";
import { ApiError } from 'browserfs/dist/node/core/api_error';

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
