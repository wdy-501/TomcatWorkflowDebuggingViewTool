#!/usr/bin/env node
// Copies the read-only case-A fixture into workbench/public/fixtures so the
// workbench can load it at runtime. Paths are resolved from this script's
// location (never from cwd). Fails non-zero when a source file is missing.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workbenchRoot = resolve(scriptDir, "..");
const repoRoot = resolve(workbenchRoot, "..");

const caseDir = "case-a-zero-rows";
const files = ["events.jsonl", "expected-facts.json"];

const sourceDir = join(repoRoot, "fixtures", caseDir);
const targetDir = join(workbenchRoot, "public", "fixtures", caseDir);

if (!existsSync(sourceDir)) {
  console.error(
    `[sync-fixtures] ERROR: fixture source directory not found: ${sourceDir}`
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

let failures = 0;
for (const file of files) {
  const from = join(sourceDir, file);
  const to = join(targetDir, file);
  if (!existsSync(from)) {
    console.error(`[sync-fixtures] ERROR: missing fixture file: ${from}`);
    failures += 1;
    continue;
  }
  copyFileSync(from, to);
  console.log(`[sync-fixtures] copied ${file} -> ${to}`);
}

if (failures > 0) {
  console.error(`[sync-fixtures] FAILED: ${failures} file(s) not copied`);
  process.exit(1);
}

console.log(`[sync-fixtures] OK: ${files.length} file(s) in ${targetDir}`);