import { BaseFileSystem, BFSCallback, FileSystem, FileSystemOptions
       } from "@marionebl/browserfs/dist/node/core/file_system";
import Stats from '@marionebl/browserfs/dist/node/core/node_fs_stats';
import { File } from "@marionebl/browserfs/dist/node/core/file";
import { FileFlag } from "@marionebl/browserfs/dist/node/core/file_flag";
import { ApiError } from '@marionebl/browserfs/dist/node/core/api_error';

export interface Device {
  open(flag: FileFlag): File;
  stat(isLstat: boolean | null): Stats;
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
    return true;
  }

  public openFileSync(p: string, flag: FileFlag): File {
    if (this.options.devices.hasOwnProperty(p)) {
      return this.options.devices[p].open(flag);
    } else {
      throw ApiError.ENOENT(p);
    }
  }
  public statSync(p: string, isLstat: boolean | null): Stats {
    if (this.options.devices.hasOwnProperty(p)) {
      return this.options.devices[p].stat(isLstat);
    } else {
      throw ApiError.ENOENT(p);
    }
  }
}
