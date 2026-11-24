/**
 * TraceBoard S7 React demo - Webpack 5 configuration (local only).
 *
 * - dev: http://127.0.0.1:5175 (strictPort), same-origin proxies:
 *     /api    -> http://127.0.0.1:8080  (demo Boot backend, reuse, no rewrite)
 *     /ingest -> http://127.0.0.1:8601  (TraceBoard collector; SDK posts /ingest/v1/events)
 *   Both proxies keep `changeOrigin: false` so `traceparent` / `X-TraceBoard-Click` are untouched.
 * - build: dist/app.js + dist/index.html only (no .map, no manifest, no CDN assets).
 * - No TraceBoard build plugin and no inline manifest: runtime SDK only.
 */
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
    clean: true
  },
  devtool: false,
  resolve: {
    // Keep the `file:../../../frontend/sdk` package resolution stable for Webpack 5.
    symlinks: false,
    extensions: [".js", ".jsx"]
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: "babel-loader"
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
      inject: "body"
    })
  ],
  devServer: {
    host: "127.0.0.1",
    // Fixed port = strict port in webpack-dev-server 5: its getFreePort() only searches for a
    // free port when `port` is undefined/"auto"; with a number it listens on exactly 5175 and
    // fails on EADDRINUSE instead of silently drifting to another port.
    port: 5175,
    static: {
      directory: path.resolve(__dirname, "public"),
      publicPath: "/"
    },
    historyApiFallback: true,
    proxy: [
      {
        context: ["/api"],
        target: "http://127.0.0.1:8080",
        changeOrigin: false
      },
      {
        context: ["/ingest"],
        target: "http://127.0.0.1:8601",
        changeOrigin: false
      }
    ]
  }
};