#!/usr/bin/env node
// Builds the BuggyShop demo frontend and copies its dist/ into
// workbench/public/demo so the 5173 dev server (and the static Pages build)
// can serve the demo at /demo/ with relative asset paths.
//
// This script intentionally does not generate demo-data.js: that snapshot is
// produced separately by export-demo-data.mjs against a real collector.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workbenchRoot = resolve(scriptDir, "..");
const repoRoot = resolve(workbenchRoot, "..");

export const demoFrontendRoot = join(repoRoot, "demo", "buggy-shop-boot-vue", "frontend");
export const demoDistDir = join(demoFrontendRoot, "dist");
export const demoPublicDir = join(workbenchRoot, "public", "demo");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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

function runDemoBuild() {
  console.log(`[sync-demo] building demo frontend: ${demoFrontendRoot}`);
  const result = spawnSync(npmCommand, ["run", "build"], {
    cwd: demoFrontendRoot,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  if (result.error !== undefined) {
    throw new Error(`[sync-demo] failed to start demo build: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `[sync-demo] demo build failed with exit code ${result.status ?? "unknown"}; ` +
        `check the output above (${demoFrontendRoot})`
    );
  }
}

/**
 * Build (unless skipBuild) and copy the demo frontend into public/demo.
 * @param {{ skipBuild?: boolean }} [options]
 * @returns {string} absolute path to the copied public/demo directory
 */
export function syncDemo({ skipBuild = false } = {}) {
  if (!existsSync(join(demoFrontendRoot, "package.json"))) {
    throw new Error(`[sync-demo] demo frontend not found: ${demoFrontendRoot}`);
  }
  if (!skipBuild) {
    runDemoBuild();
  }

  const builtIndex = join(demoDistDir, "index.html");
  if (!existsSync(builtIndex)) {
    throw new Error(
      `[sync-demo] demo build output missing: ${builtIndex}` +
        (skipBuild ? " (skipBuild was requested; build the demo first)" : "")
    );
  }

  rmSync(demoPublicDir, { recursive: true, force: true });
  // Node 24 on Windows exits 127 inside fs.cpSync when the destination exists;
  // a small recursive copy keeps this build step deterministic.
  copyDirectory(demoDistDir, demoPublicDir);
  console.log(`[sync-demo] copied ${demoDistDir} -> ${demoPublicDir}`);
  return demoPublicDir;
}

const invokedDirectly = (() => {
  if (process.argv[1] === undefined) {
    return false;
  }
  const entry = resolve(process.argv[1]);
  const self = fileURLToPath(import.meta.url);
  return process.platform === "win32"
    ? entry.toLowerCase() === self.toLowerCase()
    : entry === self;
})();

if (invokedDirectly) {
  try {
    syncDemo({ skipBuild: process.argv.includes("--skip-build") });
    console.log("[sync-demo] OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}