import * as nodeWorkers from "worker_threads";

export interface OnMessage {
  onMessage(msg: any): void;
}

export interface PostMessage {
  postMessage(msg: any): void;
}

export let makeWorker: (path: string, receiver: OnMessage) => PostMessage;
if (typeof Worker !== "undefined") {
  makeWorker = (path, receiver) => {
    const worker = new Worker(path);
    worker.onmessage = msg => receiver.onMessage(msg.data);
    return { postMessage: msg => worker.postMessage(msg) };
  };
} else {
  makeWorker = (path, receiver) => {
    const worker = new nodeWorkers.Worker(path);
    worker.on("message", msg => receiver.onMessage(msg));
    return { postMessage: msg => worker.postMessage(msg) };
  }
}
