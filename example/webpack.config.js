const path = require('path');

module.exports = {
  entry: './dist/index.js',
  mode: "production",
  externals: [
    ((context, request, callback) => {
      if (request == "worker_threads") {
        return callback(null, "commonjs " + request);
      }
      callback();
    })
  ],
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'build')
  },
  resolve: {
    // Using file:../kernel in package.json requires this
    symlinks: false
  },
  node: {
    process: false
  }
};
