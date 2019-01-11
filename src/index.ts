import MountableFileSystem from "browserfs/dist/node/backend/MountableFileSystem";
import * as handles from "./stdio_handles";
import { BFSCallback } from "browserfs/dist/node/core/file_system";
import Stats from "browserfs/dist/node/core/node_fs_stats";
import { File } from "browserfs/dist/node/core/file";
import { FileFlag } from "browserfs/dist/node/core/file_flag";
import { ApiError, ErrorCode } from "browserfs/dist/node/core/api_error";
import FS from "browserfs/dist/node/core/FS";
import { DeviceFileSystem, Device }  from "./DeviceFileSystem";
import { Process } from "./process";

export async function configureFileSystem(options: { devices: { [name: string]: Device } }): Promise<FS> {
  const devices = options.devices;
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

export { BFSCallback, Stats, File, FileFlag, FS, ApiError, ErrorCode
       , Process };
export * from "./DeviceFileSystem";
