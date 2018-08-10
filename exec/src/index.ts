import { connectParent, PostMessage } from "./worker";

async function main() {
  let parent: PostMessage;
  parent = await connectParent({
    onMessage: msg => {
      console.log(msg);
      parent.close();
    }
  });
  parent.postMessage("bar");
}

main();
