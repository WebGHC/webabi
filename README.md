Building
---

```bash
npm install
npm run build
```

Using
---

The build process will convert the TypeScript code to a usable JS
library in `./dist`, and two useful scripts in `./build`.

- The `node_runner.js` script, when run with Node, will take the path
  to a wasm file on the command line and run it.
- The `worker_runner.js` file is meant to be started in a
  WebWorker. Once started, it waits for a `postMessage` to give it the
  URI of a wasm program to fetch and execute.

In both cases, if you want a custom device driver, you will need to
use the library code instead. TypeScript types are exported so you can
continue using TypeScript.
