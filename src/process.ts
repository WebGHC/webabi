import FS from "@marionebl/browserfs/dist/node/core/FS";
import { ApiError, ErrorCode } from "@marionebl/browserfs/dist/node/core/api_error";
import Syscall from "./syscalls";
import Errno from "./errno";
import { OpenFlags, flagsToString, AtFlags, PAGE_SIZE } from "./constants";

function catchApiError(f: () => number): number {
  try {
    return f();
  } catch (e) {
    if (e.errno) {
      return -e.errno;
    } else {
      throw e;
    }
  }
}

if (typeof self === "undefined") {
  TextDecoder = require("util").TextDecoder;
  TextEncoder = require("util").TextEncoder;
}

class ExitException {
  code: number
  constructor(code: number) {
    this.code = code;
  }
}

export async function fetchAndInstantiate(url: string, importObject: any): Promise<WebAssembly.Instance> {
  let bytes: Uint8Array;
  if (typeof self !== 'undefined'){
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    bytes = new Uint8Array(buf);
  } else {
    const fsMod = await import("fs");
    const buf = await fsMod.readFileSync(url);
    bytes = new Uint8Array(buf);
  }
  const results = await WebAssembly.instantiate(bytes, importObject);
  return results.instance;
}

export class Process {
  fs: FS;
  instance: WebAssembly.Instance;
  memoryEnd: number;
  heap: ArrayBuffer;
  heapBuffer: Buffer;
  heap_uint8: Uint8Array;
  heap_uint32: Uint32Array;
  textDecoder: TextDecoder = new TextDecoder();
  textEncoder: TextEncoder = new TextEncoder();
  nanosleepWaiter: Int32Array = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

  msgBufferPtr: number = 0;

  static async instantiateProcess(fs: FS, url: string): Promise<Process> {
    const proc = new Process(fs);
    const syscall = proc.syscall.bind(proc);
    const syscall_ = proc.syscall_.bind(proc);
    const importObj = {
      env: {
        __syscall: syscall_,
        __syscall0: syscall,
        __syscall1: syscall,
        __syscall2: syscall,
        __syscall3: syscall,
        __syscall4: syscall,
        __syscall5: syscall,
        __syscall6: syscall,
        setjmp: () => { throw "setjmp NYI"; },
        longjmp: () => { throw "longjmp NYI"; }
      }
    };

    const instance = await fetchAndInstantiate(url, importObj);
    proc.instance = instance;
    proc.setMemory(instance.exports.memory);
    return proc;
  }

  constructor(fs: FS) {
    this.fs = fs;
  }

  setMemory(m: WebAssembly.Memory): void {
    this.heap = m.buffer;
    this.heapBuffer = Buffer.from(this.heap);
    this.heap_uint8 = new Uint8Array(this.heap);
    this.heap_uint32 = new Uint32Array(this.heap);
    this.memoryEnd = this.heap_uint8.length;
  }

  growMemory(n: number): void {
    this.instance.exports.memory.grow(n);
    this.setMemory(this.instance.exports.memory);
  }

  dump(offset : number, length: number): void {
    for(let o = offset; o <= offset+length; o+=16) {
      var line = [];
      for(var i = 0; i < 16; i++) {
	line.push( ("0"+this.heap_uint8[o+i].toString(16)).slice(-2) );
      }
      var asciiline = []
      for (var i = 0; i < 16; i++) {
	let x = this.heap_uint8[o+i];
	if(x > 30 && x < 128) {
	  asciiline.push( String.fromCharCode(x) );
	} else {
	  asciiline.push(".");
	}
      }
      console.warn("0x" + ("00000000" + o.toString(16)).slice(-8) + " ", line.join(" "), " | ", asciiline.join(""));
    }
  }

  buildStringTable(args: string[], envs: string[], p: number): number {
    var elems = new Uint32Array(args.length + 1 + envs.length + 1);
    var ptr = p + (args.length + 1 + envs.length + 1) * Int32Array.BYTES_PER_ELEMENT;
    for(let i = 0; i < args.length; i++) {
      elems[i] = ptr;
      ptr += this.cstringToHeap(ptr, args[i]);
    }
    elems[args.length] = 0;

    for(let i = 0; i < envs.length; i++) {
      elems[args.length + 1 + i] = ptr;
      ptr += this.cstringToHeap(ptr, envs[i]);
    }
    elems[envs.length] = 0;

    this.heap_uint32.set(elems, p / Int32Array.BYTES_PER_ELEMENT);

    // word size align the return value.
    return Math.ceil(ptr / Int32Array.BYTES_PER_ELEMENT) * Int32Array.BYTES_PER_ELEMENT ;
  }

  start(args: string[], envs: string[] ): number {
    try {
      const p = this.memoryEnd;
      // reserve some space for argc, argv, ...
      this.growMemory(1);
      // we will put argc, argv, and envp onto out as follows
      // argc | argv[0] | argv[1] | argv[2] | ... | envp[0] | ...
      this.heap_uint32[p/Int32Array.BYTES_PER_ELEMENT + 0] = args.length;
      this.buildStringTable(args, envs, p + Int32Array.BYTES_PER_ELEMENT);

      this.instance.exports._start(p);
      return 1; // Should never reach this.
    } catch(e) {
      if (e instanceof ExitException) {
        return e.code;
      } else {
        throw e;
      }
    }
  }

  encodeMsg(str:string): Uint8Array {
    var a = this.textEncoder.encode(str);
    var size = a.length;
    var b = new ArrayBuffer(size + 4);
    var dataview = new DataView(b);
    dataview.setUint32(0, size);
    const uint8 = new Uint8Array(b);
    uint8.set(a, 4);
    return uint8;
  }

  // decodeMsg(str:string): string {
  //   var a = this.textDecoder(str);
  //   var size = a.length;
  //   var b = new ArrayBuffer(size + 4);
  //   var dataview = new DataView(b);
  //   dataview.setUint32(0, size);
  //   const uint8 = new Uint8Array(b);
  //   uint8.set(a, 4);
  //   return dec.decode(msg);
  // }
  // appendBuffer (buffer1: Uint8Array, buffer2: Uint8Array ): Uint8Array {
  //   var tmp = new Uint8Array( buffer1.byteLength + buffer2.byteLength );
  //   tmp.set( new Uint8Array( buffer1 ), 0 );
  //   tmp.set( new Uint8Array( buffer2 ), buffer1.byteLength );
  //   return tmp.buffer;
  // }

  process_async(msgs: string[]): string[] {
    if (this.msgBufferPtr == 0) {
      console.log("allocating msgBufferPtr");
      this.msgBufferPtr = this.instance.exports.jsaddleBufferAlloc(1000*1000);
    }
    var ptr = this.msgBufferPtr;
    for (var i = 0; i < msgs.length; i++) {
      // Copy to heap
      // var msg = this.encodeMsg(msgs[i]);
      var msg = this.textEncoder.encode(msgs[i]);
      this.heap_uint8.set(msg, ptr);
      ptr = ptr + msg.byteLength;
    }
    var dataLen = ptr - this.msgBufferPtr;
    var n = this.instance.exports.appExecStep(dataLen);
    var retMsgs = [];
    if (n > 0) {
      var done = 0;
      while (done < n) {
        var pos = this.msgBufferPtr + done;
        // var size = this.heap_uint32[pos/Int32Array.BYTES_PER_ELEMENT];
        var size = n;
        var thisMsg = this.heap_uint8.slice(pos, pos + size);
        done = size;
        retMsgs.push(this.textDecoder.decode(thisMsg));
      }
    }
    return retMsgs;
  }

  heapStr(ptr: number): string {
    const end = this.heap_uint8.indexOf(0, ptr);
    if (end === -1) {
      throw "heapStr: expected a null-terminated string";
    }
    return this.textDecoder.decode(this.heap_uint8.subarray(ptr, end));
  }

  stringToHeap(bufPtr: number, bufsize: number, str: string): void {
    const arr: Uint8Array = this.textEncoder.encode(str);
    this.heap_uint8.set(arr.subarray(0, bufsize), bufPtr);
  }

  cstringToHeap(bufPtr: number, str: string): number {
    const arr: Uint8Array = this.textEncoder.encode(str);
    this.heap_uint8.set(arr, bufPtr);
    this.heap_uint8[bufPtr+arr.length] = 0x0;
    return arr.byteLength+1;
  }

  syscall_(sys: number, addr: number): number {
    var i = addr / Int32Array.BYTES_PER_ELEMENT;

    return this.syscall(
      sys,
      this.heap_uint32[    i],
      this.heap_uint32[1 + i],
      this.heap_uint32[2 + i],
      this.heap_uint32[3 + i],
      this.heap_uint32[4 + i],
      this.heap_uint32[5 + i]
    );
  }

  syscall(sys: number, arg1: number, arg2: number, arg3: number, arg4: number, arg5: number, arg6: number): number {
    switch (sys) {
      case Syscall.SYS_exit:
        throw new ExitException(arg1);
      case Syscall.SYS_read:
        return this.read(arg1, arg2, arg3);
      case Syscall.SYS_write:
        return this.write(arg1, arg2, arg3);
      case Syscall.SYS_open:
        return this.open(arg1, arg2, arg3);
      case Syscall.SYS_close:
        return this.close(arg1);
      case Syscall.SYS_creat:
        return this.creat(arg1, arg2);
      case Syscall.SYS_link:
        return this.link(arg1, arg2);
      case Syscall.SYS_unlink:
        return this.unlink(arg1);
      case Syscall.SYS_chmod:
        return this.chmod(arg1, arg2);
      case Syscall.SYS_lchown:
        return this.lchown(arg1, arg2, arg3);
      case Syscall.SYS_stime:
        return this.stime(arg1);
      case Syscall.SYS_rename:
        return this.rename(arg1, arg2);
      case Syscall.SYS_mkdir:
        return this.mkdir(arg1, arg2);
      case Syscall.SYS_rmdir:
        return this.rmdir(arg1);
      case Syscall.SYS_brk:
        return this.brk(arg1);
      case Syscall.SYS_ioctl:
        // console.warn("SYS_ioctl being ignored");
        return 0;
      case Syscall.SYS_symlink:
        return this.symlink(arg1, arg2);
      case Syscall.SYS_readlink:
        return this.readlink(arg1, arg2, arg3);
      case Syscall.SYS_munmap:
        return this.munmap(arg1, arg2);
      case Syscall.SYS_truncate:
        return this.truncate(arg1, arg2);
      case Syscall.SYS_ftruncate:
        return this.ftruncate(arg1, arg2);
      case Syscall.SYS_sysinfo:
        // console.warn("SYS_sysinfo being ignored");
        return 0;
      case Syscall.SYS__newselect:
        return this._newselect(arg1, arg2, arg3, arg4, arg5);
      case Syscall.SYS_readv:
        return this.readv(arg1, arg2, arg3);
      case Syscall.SYS_writev:
        return this.writev(arg1, arg2, arg3);
      case Syscall.SYS_nanosleep:
        return this.nanosleep(arg1, arg2);
      case Syscall.SYS_poll:
        return this.poll(arg1, arg2, arg3);
      case Syscall.SYS_rt_sigaction:
        // console.warn("rt_sigaction being ignored");
        return 0;
      case Syscall.SYS_rt_sigprocmask:
        // console.warn("rt_sigprocmask being ignored");
        return 0;
      case Syscall.SYS_set_thread_area:
        // console.warn("set_thread_area being ignored");
        return 0;
      case Syscall.SYS_mmap2:
        return this.mmap2(arg1, arg2, arg3, arg4, arg5, arg6);
      case Syscall.SYS_madvise:
        // console.warn("SYS_madvise being ignored");
        return 0;
      case Syscall.SYS_exit_group:
        // console.warn("SYS_exit_group being ignored");
        return 0;
      case Syscall.SYS_set_tid_address:
        // console.warn("set_tid_address being ignored");
        return 0;
      case Syscall.SYS_timer_create:
        // console.warn("timer_create being ignored");
        return  0;
      case Syscall.SYS_timer_settime:
        // console.warn("timer_settime being ignored");
        return  0;
      case Syscall.SYS_timer_delete:
        // console.warn("timer_delete being ignored");
        return  0;
      case Syscall.SYS_clock_gettime:
        return this.clockGettime(arg1, arg2);
      case Syscall.SYS_openat:
        return this.openat(arg1, arg2, arg3, arg4);
      case Syscall.SYS_mkdirat:
        return this.mkdirat(arg1, arg2, arg3);
      case Syscall.SYS_unlinkat:
        return this.unlinkat(arg1, arg2, arg3);
      case Syscall.SYS_linkat:
        return this.linkat(arg1, arg2, arg3, arg4, arg5);
      case Syscall.SYS_symlinkat:
        return this.symlinkat(arg1, arg2, arg3);
      case Syscall.SYS_readlinkat:
        return this.readlinkat(arg1, arg2, arg3, arg4);
      case Syscall.SYS_fstat64:
        return this.fstat64(arg1, arg2);
      case Syscall.SYS_stat64:
        // console.warn("stat64 being ignored");
        return  0;
      default:
        throw (Syscall[sys] + " NYI");
    }
  }

  read(fd: number, bufPtr: number, count: number): number {
    return catchApiError(() => this.fs.readSync(fd, this.heapBuffer, bufPtr, count, null));
  }

  write(fd: number, bufPtr: number, count: number): number {
    return catchApiError(() => this.fs.writeSync(fd, this.heapBuffer, bufPtr, count, null));
  }

  open(pathnamePtr: number, flags: number, mode: number): number {
    return this.openat(AtFlags.AT_FDCWD, pathnamePtr, flags, mode);
  }

  close(fd: number): number {
    this.fs.close(fd);
    return 0;
  }

  creat(pathnamePtr: number, mode: number): number {
    return this.openat(
      AtFlags.AT_FDCWD,
      pathnamePtr,
      OpenFlags.O_CREAT|OpenFlags.O_WRONLY|OpenFlags.O_TRUNC,
      mode
    );
  }

  link(oldpathPtr: number, newpathPtr: number): number {
    return this.linkat(AtFlags.AT_FDCWD, oldpathPtr, AtFlags.AT_FDCWD, newpathPtr, 0);
  }

  unlink(pathnamePtr: number): number {
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      this.fs.unlinkSync(path);
      return 0;
    });
  }

  chmod(pathnamePtr: number, mode: number): number {
    var path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      this.fs.chmod(path, mode);
      return 0;
    });
  }

  lchown(pathnamePtr: number, owner: number, group: number): number {
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      this.fs.lchownSync(path, owner, group)
      return 0;
    });
  }

  stime(t: number): number {
    return -(Errno.EPERM);
  }

  rename(oldpathPtr: number, newpathPtr: number): number {
    const oldPath = this.heapStr(oldpathPtr);
    const newPath = this.heapStr(newpathPtr);
    return catchApiError(() => {
      this.fs.renameSync(oldPath, newPath)
      return 0;
    });
  }

  mkdir(pathnamePtr: number, mode: number): number {
    return this.mkdirat(AtFlags.AT_FDCWD, pathnamePtr, mode);
  }

  rmdir(pathnamePtr: number): number {
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      this.fs.rmdirSync(path)
      return 0;
    });
  }

  brk(addr: number): number {
    const numPages = Math.ceil(addr / PAGE_SIZE);
    const oldPages = this.heap_uint8.length / PAGE_SIZE;
    const oldEnd = this.memoryEnd;
    if (addr > this.memoryEnd) {
      this.memoryEnd = addr;
      if (numPages > oldPages) {
        this.instance.exports.memory.grow(numPages - oldPages);
        this.setMemory(this.instance.exports.memory);
      }
    }
    return oldEnd;
  }

  symlink(targetPtr: number, linkpathPtr: number): number {
    return this.symlinkat(targetPtr, AtFlags.AT_FDCWD, linkpathPtr);
  }

  readlink(pathnamePtr: number, bufPtr: number, bufsiz: number): number {
    return this.readlinkat(AtFlags.AT_FDCWD, pathnamePtr, bufsiz, bufsiz);
  }

  munmap(addr: number, len: number): number {
    if (addr + len === this.memoryEnd) {
      this.memoryEnd = addr;
    } else {
      console.warn("SYS_munmap being ignored");
    }
    return 0;
  }

  truncate(pathPtr: number, length: number): number {
    const path = this.heapStr(pathPtr);
    return catchApiError(() => {
      this.fs.truncate(path, length)
      return 0;
    });
  }

  ftruncate(fd: number, length: number): number {
    return catchApiError(() => {
      this.fs.ftruncate(fd, length)
      return 0;
    });
  }

  _newselect(nfds: number, readfds_: number, writefds_: number, exceptfds_: number, timeout_: number): number {
    // ignore exceptfds_

    const timeout = timeout_ / 4;
    const timeoutSec = this.heap_uint32[timeout];
    const timeoutUSec = this.heap_uint32[timeout + 1];
    // nfds == 0 means this is just a timeout/delay request
    if (nfds == 0 && (timeoutSec !== 0 ||  timeoutUSec !== 0)) {
      Atomics.wait(this.nanosleepWaiter, 0, 0, timeoutSec * 1000 + timeoutUSec / 1000);
    }

    let nonzero = 0;
    for (let i = 0; i < nfds; i++) {
      const fds_ = writefds_;
      const fds = fds_ / 4;
      const fd = this.heap_uint32[fds + i];
      const events = this.heap_uint8[fds_ + i + 4];
      if (fd == 1) {
        // Assume std_out to be always ready
        // ignore events
        // Write to revents
        this.heap_uint8[fds_ + i + 5] = 4; // POLLOUT
        nonzero += 1;
      } else {
        console.error("SYS__newselect FD: " + fd + ", " + events);
        throw "SYS__newselect FD not handled";
      }
    }
    return nonzero;
  }

  readv(fd: number, iov_: number, iovcnt: number): number {
    var iov = iov_ / 4;
    var rtn = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = this.heap_uint32[iov];
      iov++;
      var len = this.heap_uint32[iov];
      iov++;
      if (len > 0) {
        var r = this.read(fd, ptr, len);
        if (r < 0) {
          return r;
        } else if (r < len) {
          return rtn + r;
        }

        rtn += r;
      }
    }
    return rtn;
  }

  writev(fd: number, iov_: number, iovcnt: number): number {
    var iov = iov_ / 4;
    var rtn = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = this.heap_uint32[iov];
      iov++;
      var len = this.heap_uint32[iov];
      iov++;
      if (len > 0) {
        var r = this.write(fd, ptr, len);
        if (r < 0) {
          return r;
        } else if (r < len) {
          return rtn + r;
        }

        rtn += r;
      }
    }
    return rtn;
  }

  nanosleep(req: number, ret: number): number {
    var seconds = this.heap_uint32[req / Int32Array.BYTES_PER_ELEMENT];
    var nanoseconds = this.heap_uint32[(req / Int32Array.BYTES_PER_ELEMENT) + 1];
    Atomics.wait(this.nanosleepWaiter, 0, 0, seconds * 1000 + nanoseconds / 1000000);
    return 0;
  }

  poll(fds_: number, nfds: number, timeoutMSec: number): number {
    // nfds == 0 means this is just a timeout/delay request
    if (nfds == 0) {
      Atomics.wait(this.nanosleepWaiter, 0, 0, timeoutMSec);
    }

    const fds = fds_ / 4;
    let nonzero = 0;
    for (let i = 0; i < nfds; i++) {
      const fd = this.heap_uint32[fds + i];
      // short is uint8
      const events = this.heap_uint8[fds_ + i + 4];
      if (fd == 1) {
        // Assume std_out to be always ready
        // ignore events
        // Write to revents
        this.heap_uint8[fds_ + i + 5] = 4; // POLLOUT
        nonzero += 1;
      } else {
        console.error("SYS_poll FD: " + fd + ", " + events);
        throw "SYS_poll FD not handled";
      }
    }
    return nonzero;
  }

  mmap2(addr: number, len: number, prot: number, flags: number, fd: number, offset: number): number {
    // Ignore prot and flags
    var currentSize = this.memoryEnd;
    if ((fd === -1) && (offset === 0)) {
      var newSize = this.brk(currentSize + len);
      return currentSize;
    } else {
      throw ("SYS_mmap2 NYI: "
             + addr + ", "
             + len + ", "
             + fd + ", "
             + offset + ", ");
    }
  }

  clockGettime(clockid: number, timespec_: number): number {
    // Ignore clockid
    var milliseconds = Date.now();
    var seconds = Math.floor(milliseconds/1000);
    var nanoseconds = (milliseconds % 1000) * 1000 * 1000;
    var ptr = timespec_ / 4;
    this.heap_uint32[ptr] = seconds;
    this.heap_uint32[ptr + 1] = nanoseconds;
    return 0;
  }

  openat(dirfd: number, pathnamePtr: number, flags: number, mode: number): number {
    if (dirfd !== AtFlags.AT_FDCWD) {
      throw "openat: TODO: dirfd other than AT_FDCWD";
    }
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => this.fs.openSync(path, flagsToString(flags), mode));
  }

  mkdirat(dirfd: number, pathnamePtr: number, mode: number): number {
    if (dirfd !== AtFlags.AT_FDCWD) {
      throw "mkdirat: TODO: dirfd other than AT_FDCWD";
    }
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      this.fs.mkdirSync(path, mode);
      return 0;
    });
  }

  unlinkat(dirfd: number, pathnamePtr: number, flags: number): number {
    if (dirfd !== AtFlags.AT_FDCWD) {
      throw "unlinkat: TODO: dirfd other than AT_FDCWD";
    }
    if (flags & AtFlags.AT_REMOVEDIR) {
      return this.rmdir(pathnamePtr);
    } else {
      return this.unlink(pathnamePtr);
    }
  }

  linkat(oldDirFd: number, oldPathPtr: number, newDirFd: number, newPathPtr: number, flags: number): number {
    if (oldDirFd !== AtFlags.AT_FDCWD || newDirFd !== AtFlags.AT_FDCWD) {
      throw "linkat: TODO: dirfd other than AT_FDCWD";
    }
    const oldPath = this.heapStr(oldPathPtr);
    const newPath = this.heapStr(newPathPtr);
    return catchApiError(() => {
      this.fs.linkSync(oldPath, newPath)
      return 0;
    });
  }

  symlinkat(targetPtr: number, newDirFd: number, newPathPtr: number): number {
    if (newDirFd !== AtFlags.AT_FDCWD) {
      throw "symlinkat: TODO: dirfd other than AT_FDCWD";
    }
    const target = this.heapStr(targetPtr);
    const newPath = this.heapStr(newPathPtr);
    return catchApiError(() => {
      this.fs.symlinkSync(target, newPath)
      return 0;
    });
  }

  readlinkat(dirfd: number, pathnamePtr: number, bufPtr: number, bufsize: number): number {
    if (dirfd !== AtFlags.AT_FDCWD) {
      throw "readlinkat: TODO: dirfd other than AT_FDCWD";
    }
    const path = this.heapStr(pathnamePtr);
    return catchApiError(() => {
      const str = this.fs.readlinkSync(path);
      this.stringToHeap(bufPtr, bufsize, str);
      return 0;
    });
  }

  // TODO
  fstat64(fd: number, statbuf_: number): number {
    var st_mode_ptr = (statbuf_ + 16) / 4;
    this.heap_uint32[st_mode_ptr] = 8192;
    return 0;
  }
}
