export enum OpenFlags {
  O_APPEND = 0x400,
  O_CREAT  = 0x40,
  O_EXCL   = 0x80,
  O_RDONLY = 0x00,
  O_RDWR   = 0x02,
  O_SYNC   = 0x1000,
  O_TRUNC  = 0x200,
  O_WRONLY = 0x01,
}

// BrowserFS only supports string flags. See:
// https://github.com/nodejs/node/blob/master/lib/internal/fs.js
// Hopefully flagsToString . stringToFlags = id
// TODO: possibly make a PR to BrowserFS to support integer flags?
export function flagsToString(a: number): string {
  switch(a & 0x1fff) {
  case OpenFlags.O_RDONLY: return 'r';
  case OpenFlags.O_RDONLY | OpenFlags.O_SYNC: return 'rs';
  case OpenFlags.O_RDWR: return 'r+';
  case OpenFlags.O_RDWR | OpenFlags.O_SYNC: return 'rs+';

  case OpenFlags.O_TRUNC | OpenFlags.O_CREAT | OpenFlags.O_WRONLY: return 'w';
  case OpenFlags.O_TRUNC | OpenFlags.O_CREAT | OpenFlags.O_WRONLY | OpenFlags.O_EXCL: return 'wx';

  case OpenFlags.O_TRUNC | OpenFlags.O_CREAT | OpenFlags.O_RDWR: return 'w+';
  case OpenFlags.O_TRUNC | OpenFlags.O_CREAT | OpenFlags.O_RDWR | OpenFlags.O_EXCL: return 'wx+';

  case OpenFlags.O_APPEND | OpenFlags.O_CREAT | OpenFlags.O_WRONLY: return 'a';
  case OpenFlags.O_APPEND | OpenFlags.O_CREAT | OpenFlags.O_WRONLY | OpenFlags.O_EXCL: return 'ax';

  case OpenFlags.O_APPEND | OpenFlags.O_CREAT | OpenFlags.O_RDWR: return 'a+';
  case OpenFlags.O_APPEND | OpenFlags.O_CREAT | OpenFlags.O_RDWR | OpenFlags.O_EXCL: return 'ax+';
  }

  // TODO
  return 'r+';
  // throw ('flagToString: Invalid flag value: ' + a);
}

export enum AtFlags {
  AT_FDCWD              = -0x64,
  AT_SYMLINK_NOFOLLOW   = 0x100,
  AT_REMOVEDIR          = 0x200,
  AT_SYMLINK_FOLLOW     = 0x400,
  AT_NO_AUTOMOUNT       = 0x800,
  AT_EMPTY_PATH         = 0x1000,
  AT_STATX_SYNC_TYPE    = 0x6000,
  AT_STATX_SYNC_AS_STAT = 0x0000,
  AT_STATX_FORCE_SYNC   = 0x2000,
  AT_STATX_DONT_SYNC    = 0x4000,
}

export const PAGE_SIZE = 65536;
