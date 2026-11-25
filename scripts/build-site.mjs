#!/usr/bin/env node
// Builds the complete static GitHub Pages site:
//   1. builds the demo frontend and copies it to workbench/public/demo
//   2. builds the workbench with a relative base into workbench/dist-site
//   3. replaces site/traceboard/dist/app with dist-site
//   4. copies the collector-exported demo-data.js into app/
//   5. injects <script src="./demo-data.js"></script> before the app entry
//   6. refreshes the landing page + styles and asserts the expected files
//
// Node ESM only, no third-party dependencies.
//
// Usage:
//   node scripts/build-site.mjs                    # full build
//   node scripts/build-site.mjs --skip-demo-build  # reuse workbench/public/demo
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { syncDemo, demoPublicDir, demoFrontendRoot } from "../workbench/scripts/sync-demo.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const workbenchRoot = join(repoRoot, "workbench");
const siteRoot = join(repoRoot, "site", "traceboard");
const siteDistDir = join(siteRoot, "dist");
const appDir = join(siteDistDir, "app");
const workbenchDistSite = join(workbenchRoot, "dist-site");

const skipDemoBuild = process.argv.includes("--skip-demo-build");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function fail(message) {
  throw new Error(`[build-site] ${message}`);
}

function assertFile(file, label) {
  if (!existsSync(file)) {
    fail(`${label} missing: ${file}`);
  }
}

function runNpm(args, cwd) {
  console.log(`[build-site] (${cwd}) npm ${args.join(" ")}`);
  const result = spawnSync(npmCommand, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  if (result.error !== undefined) {
    fail(`failed to start npm ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`npm ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function clearDirectoryContents(dir) {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function copyDirectory(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? countFiles(full) : 1;
  }
  return total;
}

function injectDemoDataScript(html, version) {
  const scriptTag = `<script src="./demo-data.js?v=${version}"></script>`;
  const existing = /<script\b[^>]*src=["']\.\/demo-data\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;
  if (existing.test(html)) {
    return { html: html.replace(existing, scriptTag), injected: false };
  }
  const moduleTag = /^([ \t]*)<script\b[^>]*\btype=["']module["'][^>]*>/m.exec(html);
  if (moduleTag === null) {
    fail("app/index.html has no <script type=\"module\"> entry; cannot inject demo-data.js");
  }
  const indent = moduleTag[1] ?? "";
  const injectedHtml =
    html.slice(0, moduleTag.index) + `${indent}${scriptTag}\n` + html.slice(moduleTag.index);
  return { html: injectedHtml, injected: true };
}

function main() {
  assertFile(join(workbenchRoot, "package.json"), "workbench package.json");
  assertFile(join(demoFrontendRoot, "package.json"), "demo frontend package.json");
  assertFile(join(siteRoot, "demo-data.js"), "site demo-data.js");

  // 1. Demo assets in workbench/public/demo.
  if (skipDemoBuild) {
    if (!existsSync(join(demoPublicDir, "index.html"))) {
      fail(
        `--skip-demo-build was requested but ${demoPublicDir} has no index.html; ` +
          "run `npm run demo:sync` in workbench/ first"
      );
    }
    console.log(`[build-site] reusing demo assets: ${demoPublicDir}`);
  } else {
    syncDemo();
  }

  // Version the demo iframe by its build output so old Pages caches do not
  // keep an index that references assets removed by the new deployment.
  const demoIndexSource = join(demoPublicDir, "index.html");
  const demoVersion = createHash("sha256")
    .update(readFileSync(demoIndexSource))
    .digest("hex")
    .slice(0, 10);
  process.env.VITE_DEMO_VERSION = demoVersion;

  // 2. Workbench static build with a relative base.
  runNpm(["run", "sync:fixtures"], workbenchRoot);
  runNpm(["run", "build:site"], workbenchRoot);
  assertFile(join(workbenchDistSite, "index.html"), "workbench dist-site/index.html");
  assertFile(join(workbenchDistSite, "demo", "index.html"), "workbench dist-site/demo/index.html");

  // 3. Replace only the contents of site/traceboard/dist/app (keep the dir).
  clearDirectoryContents(appDir);
  copyDirectory(workbenchDistSite, appDir);
  console.log(`[build-site] replaced ${appDir} with ${workbenchDistSite}`);

  // 4. Copy the canonical, collector-exported demo snapshot.
  const demoDataSource = join(siteRoot, "demo-data.js");
  const demoDataText = readFileSync(demoDataSource, "utf8");
  const demoDataSandbox = { window: {} };
  runInNewContext(demoDataText, demoDataSandbox, { timeout: 1000 });
  const staticData = demoDataSandbox.window.__TRACEBOARD_STATIC_DEMO__;
  if (!staticData || typeof staticData !== "object") {
    fail("demo-data.js did not define window.__TRACEBOARD_STATIC_DEMO__");
  }
  const demoCases = staticData.cases ?? {};
  const caseKeys = Object.keys(demoCases);
  if (caseKeys.length !== 10) {
    fail(`demo-data cases expected 10, got ${caseKeys.length}`);
  }
  const requestIds = new Set(
    (staticData.requests?.requests ?? []).map((item) => item.traceId)
  );
  for (const key of caseKeys) {
    const traceId = demoCases[key]?.traceId;
    if (typeof traceId !== "string" || traceId === "") {
      fail(`demo-data case ${key} has no traceId`);
    }
    if (!staticData.graphs?.[traceId]) {
      fail(`demo-data case ${key} has no graph for ${traceId}`);
    }
    if (!requestIds.has(traceId)) {
      fail(`demo-data case ${key} trace is not in requests: ${traceId}`);
    }
  }
  copyFileSync(demoDataSource, join(appDir, "demo-data.js"));
  const demoDataVersion = createHash("sha256")
    .update(demoDataText)
    .digest("hex")
    .slice(0, 10);

  // 5. Load the snapshot before the workbench module entry.
  const appIndexPath = join(appDir, "index.html");
  assertFile(appIndexPath, "app/index.html");
  const { html, injected } = injectDemoDataScript(
    readFileSync(appIndexPath, "utf8"),
    demoDataVersion
  );
  if (injected) {
    writeFileSync(appIndexPath, html, "utf8");
    console.log("[build-site] injected demo-data.js before the module entry");
  } else {
    console.log("[build-site] demo-data.js already referenced by app/index.html");
  }

  // 6. Landing page + styles (the site dist keeps its own copy of both).
  const landingSource = join(siteRoot, "index.html");
  const landingTarget = join(siteDistDir, "index.html");
  if (existsSync(landingSource)) {
    copyFileSync(landingSource, landingTarget);
    console.log(`[build-site] copied landing page -> ${landingTarget}`);
  } else if (!existsSync(landingTarget)) {
    fail(`landing page missing (neither ${landingSource} nor ${landingTarget} exists)`);
  }

  const stylesSource = join(siteRoot, "assets", "styles.css");
  const stylesTarget = join(siteDistDir, "assets", "styles.css");
  if (existsSync(stylesSource)) {
    mkdirSync(dirname(stylesTarget), { recursive: true });
    copyFileSync(stylesSource, stylesTarget);
    console.log(`[build-site] copied styles -> ${stylesTarget}`);
  } else if (!existsSync(stylesTarget)) {
    console.warn(`[build-site] WARN: styles.css missing (neither ${stylesSource} nor ${stylesTarget})`);
  }

  // 7. Assert the deployable layout and print a summary.
  assertFile(join(siteDistDir, "index.html"), "site root index.html");
  assertFile(join(appDir, "index.html"), "app/index.html");
  assertFile(join(appDir, "demo", "index.html"), "app/demo/index.html");
  assertFile(join(appDir, "demo-data.js"), "app/demo-data.js");

  const appFiles = countFiles(appDir);
  const demoFiles = countFiles(join(appDir, "demo"));
  const demoDataBytes = statSync(join(appDir, "demo-data.js")).size;
  console.log("[build-site] OK");
  console.log(`[build-site] site root: ${siteDistDir}`);
  console.log(`[build-site] app files: ${appFiles} (demo: ${demoFiles})`);
  console.log(`[build-site] app/demo-data.js: ${demoDataBytes} bytes`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}