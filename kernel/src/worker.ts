export interface OnMessage {
  onMessage(msg: any): void;
}

export interface PostMessage {
  postMessage(msg: any, transferList?: [any]): void;
  close(): void;
}

export let makeWorker: (path: string, receiver: OnMessage) => Promise<PostMessage>;
if (typeof Worker !== "undefined") {
  makeWorker = async (path, receiver) => {
    const worker = new Worker(path);
    worker.onmessage = msg => receiver.onMessage(msg.data);
    return {
      postMessage: (msg, transferList) => worker.postMessage(msg, transferList),
      close: () => {}
    };
  };
} else {
  makeWorker = async (path, receiver) => {
    const nodeWorkers = await import("worker_threads");
    const worker = new nodeWorkers.Worker(path);
    worker.on("message", msg => receiver.onMessage(msg));
    return {
      postMessage: (msg, transferList) => worker.postMessage(msg, transferList),
      close: () => worker.unref()
    };
  }
}
