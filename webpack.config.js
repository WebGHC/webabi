const path = require("path");

module.exports = {
    entry: {
        "worker_runner": "./dist/worker_runner.js",
    },
    mode: "production",
    externals: [
        ((context, request, callback) => {
            if (request == "worker_threads" || request == "perf_hooks" || request == "fs" || request == "process" || request == "util") {
                return callback(null, "commonjs " + request);
            }
            callback();
        })
    ],
    output: {
        path: path.resolve(__dirname, "build")
    }
};
