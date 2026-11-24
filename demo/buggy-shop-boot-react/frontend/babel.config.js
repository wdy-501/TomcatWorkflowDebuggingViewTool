/**
 * S7 React 18 + Babel configuration (JS/JSX only, no TypeScript).
 * - preset-env keeps ESM (`modules: false`) for Webpack 5 tree handling.
 * - preset-react uses the automatic runtime (no React import needed in JSX files).
 */
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false,
        targets: {
          browsers: [
            "last 2 Chrome versions",
            "last 2 Edge versions",
            "last 2 Firefox versions",
            "last 2 Safari versions"
          ]
        }
      }
    ],
    ["@babel/preset-react", { runtime: "automatic" }]
  ]
};