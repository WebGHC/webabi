declare module "worker_threads" {
  interface MessagePort {
    postMessage(msg: any, transferList: [any]);
    on(event: "message", handler: (msg: any) => void);
    unref(): void;
  }
  export const parentPort: MessagePort;
}
