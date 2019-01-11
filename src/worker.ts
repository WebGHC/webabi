export interface OnMessage {
  onMessage(msg: any): void;
}

export interface PostMessage {
  postMessage(msg: any, transferList?: [any]): void;
  close(): void;
}

export let connectParent: (receiver: OnMessage) => Promise<PostMessage>;
if (typeof self !== "undefined") {
  connectParent = async (receiver) => {
    self.onmessage = msg => receiver.onMessage(msg.data);
    return {
      postMessage: (msg, transferList) => self.postMessage(msg, transferList as any /*tsc complains wrongly*/),
      close: () => {}
    };
  };
} else {
  connectParent = async (receiver) => {
    const nodeWorkers = await import("worker_threads");
    nodeWorkers.parentPort.on("message", msg => receiver.onMessage(msg));
    return {
      postMessage: (msg, transferList) => nodeWorkers.parentPort.postMessage(msg, transferList),
      close: () => nodeWorkers.parentPort.unref()
    };
  }
}
