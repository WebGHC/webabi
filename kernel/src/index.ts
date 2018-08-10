import MountableFileSystem from "browserfs/dist/node/backend/MountableFileSystem";
import * as handles from "./stdio_handles";
import { BFSCallback } from "browserfs/dist/node/core/file_system";
import Stats from 'browserfs/dist/node/core/node_fs_stats';
import { File } from "browserfs/dist/node/core/file";
import { FileFlag } from "browserfs/dist/node/core/file_flag";
import { ApiError, ErrorCode } from 'browserfs/dist/node/core/api_error';
import FS from "browserfs/dist/node/core/FS";
import { DeviceFileSystem, Device }  from "./DeviceFileSystem";
import Kernel from "./kernel";

export async function configureKernel(devices: { [name: string]: Device }): Promise<Kernel> {
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

  return new Kernel(fs);
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
export * from "./DeviceFileSystem";
