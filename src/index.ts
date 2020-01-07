import MountableFileSystem from "@marionebl/browserfs/dist/node/backend/MountableFileSystem";
import * as handles from "./stdio_handles";
import { BFSCallback } from "@marionebl/browserfs/dist/node/core/file_system";
import Stats from "@marionebl/browserfs/dist/node/core/node_fs_stats";
import { File } from "@marionebl/browserfs/dist/node/core/file";
import { FileFlag } from "@marionebl/browserfs/dist/node/core/file_flag";
import { ApiError, ErrorCode } from "@marionebl/browserfs/dist/node/core/api_error";
import FS from "@marionebl/browserfs/dist/node/core/FS";
import { DeviceFileSystem, Device }  from "./DeviceFileSystem";
import { Process } from "./process";

export function configureFileSystem(): FS {

  const fs = new FS();

  const fdMap: {[id: number]: File} = (fs as any).fdMap;
  fdMap[0] = handles.stdin;
  fdMap[1] = handles.stdout;
  fdMap[2] = handles.stderr;

  return fs;
}

export { BFSCallback, Stats, File, FileFlag, FS, ApiError, ErrorCode
       , Process };
export * from "./DeviceFileSystem";
