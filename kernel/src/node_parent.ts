declare module "worker_threads" {
  export class Worker {
    constructor(path: string);
    postMessage(msg: any, transferList: [any]): void;
    on(event: "message", handler: (msg: any) => void);
    unref(): void;
  }
}
