/**
 * @traceboard/vite-plugin — S5 shallow front-end build plugin.
 *
 * What it does (F1/F2 shallow, only this):
 * - scans `src/**\/*.{vue,ts}` (optionally custom roots) for named function declarations and
 *   `const x = ...wrapFn("x", ...)` assignments;
 * - produces `{"functions":[{"name","file","line"}]}` with POSIX relative `file` and 1-based
 *   **original source line** (`.vue` files use whole-file line numbers, `<template>` included);
 * - dev: serves `GET /traceboard-manifest.json` (rescanned per request, no cache);
 * - build: emits `traceboard-manifest.json` and inlines
 *   `window.__TRACEBOARD_MANIFEST__ = <json>` via `transformIndexHtml` (`head-prepend`).
 *
 * What it does NOT do:
 * - no `.map` decoding / stack un-mangling / uploads; no local variables or line-level values (S6);
 * - no third-party dependencies (only `node:fs/promises` and `node:path`);
 * - never breaks the host build: scan failures are warned and the build continues;
 * - preview injection (S4, port 8602) never gets this manifest (only external config.js/sdk.js).
 *
 * Scan rules (shallow regex, no AST):
 *   R1 ^[\t ]*(?:export[\t ]+)?(?:async[\t ]+)?function[\t ]+([A-Za-z_$][\w$]*)[\t ]*\(
 *   R2 ^[\t ]*(?:export[\t ]+)?const[\t ]+([A-Za-z_$][\w$]*)[\t ]*=[^;\n]*wrapFn\([\t ]*["']\1["']
 *
 * Determinism: files sorted by POSIX relative path; duplicate names keep the first definition and
 * warn; entries sorted by file, line, name; at most 500 entries (truncation warns).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = "/traceboard-manifest.json";
const MANIFEST_FILE = "traceboard-manifest.json";
const DEFAULT_INCLUDE = ["src/**/*.vue", "src/**/*.ts"];
const MAX_ENTRIES = 500;
const SKIP_DIRS = new Set(["node_modules", "dist", "public", ".git", ".traceboard"]);

const R1 = /^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/;
const R2 = /^[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[^;\n]*wrapFn\([ \t]*["']\1["']/;

function toPosix(filePath) {
  return String(filePath).split(path.sep).join("/");
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function globToRegExp(pattern) {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          out += "(?:[^/]+/)*";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if ("\\^$+?.()|{}[]".includes(ch)) {
      out += `\\${ch}`;
    } else if (ch === "/") {
      out += "/";
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

function staticBase(pattern) {
  const star = pattern.indexOf("*");
  const prefix = star === -1 ? pattern : pattern.slice(0, star);
  const slash = prefix.lastIndexOf("/");
  return slash === -1 ? "." : prefix.slice(0, slash);
}

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

function errorMessage(error, maxLength) {
  const text =
    error && typeof error === "object" && typeof error.message === "string"
      ? error.message
      : String(error);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function escapeInlineJson(json) {
  // "<" must never close the injected <script> early ("</script>").
  return json.replace(/</g, "\\u003c");
}

/**
 * Scan a project root for shallow function facts.
 * @param {{ root?: string, include?: string[], warn?: (message: string) => void }} [options]
 * @returns {Promise<{ functions: { name: string, file: string, line: number }[] }>}
 */
export async function scanFunctions(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const includes =
    Array.isArray(options.include) && options.include.length > 0
      ? options.include.map(String)
      : DEFAULT_INCLUDE.slice();
  const warn = typeof options.warn === "function" ? options.warn : () => {};

  const matchers = includes.map((pattern) => ({ pattern, regex: globToRegExp(pattern) }));
  const baseDirs = new Set();
  for (const pattern of includes) {
    baseDirs.add(path.resolve(root, staticBase(pattern)));
  }

  const found = new Set();
  for (const baseDir of baseDirs) {
    const files = [];
    await walk(baseDir, files);
    for (const file of files) {
      found.add(file);
    }
  }

  const relativeFiles = [];
  for (const file of found) {
    const rel = toPosix(path.relative(root, file));
    if (rel.startsWith("..")) {
      continue;
    }
    if (matchers.some((matcher) => matcher.regex.test(rel))) {
      relativeFiles.push(rel);
    }
  }
  relativeFiles.sort(compareText);

  const seen = new Set();
  const entries = [];
  for (const rel of relativeFiles) {
    let content;
    try {
      content = await readFile(path.join(root, rel), "utf8");
    } catch (error) {
      throw new Error(`manifest scan failed to read ${rel}: ${errorMessage(error, 120)}`);
    }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === "") {
        continue;
      }
      const match = R1.exec(line) || R2.exec(line);
      if (!match) {
        continue;
      }
      const name = match[1];
      if (seen.has(name)) {
        warn(`duplicate function "${name}" (${rel}:${index + 1}) ignored; first definition wins`);
        continue;
      }
      seen.add(name);
      entries.push({ name, file: rel, line: index + 1 });
    }
  }

  entries.sort((a, b) => {
    if (a.file !== b.file) {
      return compareText(a.file, b.file);
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return compareText(a.name, b.name);
  });

  let functions = entries;
  if (functions.length > MAX_ENTRIES) {
    warn(`manifest has ${functions.length} functions, truncated to ${MAX_ENTRIES}`);
    functions = functions.slice(0, MAX_ENTRIES);
  }
  return { functions };
}

/**
 * Vite plugin factory (default export). The frozen integration is the default import:
 * `import traceboardShallow from "../../../frontend/build-plugin/index.mjs"`.
 * @param {{ root?: string, include?: string[] }} [options]
 * @returns {{ name: string, [key: string]: any }}
 */
export function traceboardManifest(options = {}) {
  const includes =
    Array.isArray(options.include) && options.include.length > 0
      ? options.include.slice()
      : DEFAULT_INCLUDE.slice();
  const optionRoot = options.root ? path.resolve(options.root) : null;
  let root = optionRoot || process.cwd();

  const scan = (warn) => scanFunctions({ root, include: includes, warn });

  return {
    name: "traceboard-shallow",

    configResolved(config) {
      if (optionRoot) {
        root = optionRoot;
        return;
      }
      if (config && typeof config.root === "string" && config.root !== "") {
        root = config.root;
      }
    },

    configureServer(server) {
      const logWarn = (message) => {
        try {
          const logger = server && server.config && server.config.logger;
          if (logger && typeof logger.warn === "function") {
            logger.warn(`[traceboard-shallow] ${message}`);
          }
        } catch {
          // fail-open
        }
      };
      server.middlewares.use((req, res, next) => {
        let pathname;
        try {
          pathname = new URL(req.url || "/", "http://localhost").pathname;
        } catch {
          next();
          return;
        }
        if (pathname !== MANIFEST_PATH) {
          next();
          return;
        }
        const method = String((req && req.method) || "GET").toUpperCase();
        const sendJson = (status, payload) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        };
        if (method !== "GET" && method !== "HEAD") {
          sendJson(405, { error: "method_not_allowed" });
          return;
        }
        scan(logWarn)
          .then((manifest) => {
            try {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(serializeManifest(manifest));
            } catch {
              // fail-open: a broken response must not crash the dev server
            }
          })
          .catch((error) => {
            sendJson(500, {
              error: "manifest_scan_failed",
              message: errorMessage(error, 200)
            });
          });
      });
    },

    async transformIndexHtml() {
      const warn = (message) => {
        try {
          this.warn(`[traceboard-shallow] ${message}`);
        } catch {
          // fail-open
        }
      };
      try {
        const manifest = await scan(warn);
        const json = escapeInlineJson(JSON.stringify(manifest));
        return [
          {
            tag: "script",
            children: `window.__TRACEBOARD_MANIFEST__ = ${json};`,
            injectTo: "head-prepend"
          }
        ];
      } catch (error) {
        warn(`inline manifest skipped: ${errorMessage(error, 200)}`);
        return [];
      }
    },

    async generateBundle() {
      const warn = (message) => {
        try {
          this.warn(`[traceboard-shallow] ${message}`);
        } catch {
          // fail-open
        }
      };
      try {
        const manifest = await scan(warn);
        this.emitFile({
          type: "asset",
          fileName: MANIFEST_FILE,
          source: serializeManifest(manifest)
        });
      } catch (error) {
        warn(`manifest asset skipped: ${errorMessage(error, 200)}`);
      }
    }
  };
}

/** Guide alias; identical to the default export. */
export const traceboardShallow = traceboardManifest;

export default traceboardManifest;