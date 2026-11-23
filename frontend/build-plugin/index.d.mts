/**
 * Type declarations for `@traceboard/vite-plugin` (S5 shallow manifest).
 *
 * The plugin object is typed with a minimal structural shape on purpose: the demo resolves
 * `../../../frontend/build-plugin/index.mjs` with `moduleResolution: "bundler"` and must not
 * depend on the `vite` package types here. A Vite plugin only requires `name`; the hook
 * signatures stay loose (`any`) so the object is assignable to Vite's `PluginOption`.
 */

export interface TraceboardManifestEntry {
  /** Function name exactly as scanned from the source (no minified names). */
  name: string;
  /** POSIX path relative to the project root (never absolute). */
  file: string;
  /** 1-based original source line (`.vue` uses whole-file line numbers). */
  line: number;
}

export interface TraceboardManifest {
  functions: TraceboardManifestEntry[];
}

export interface TraceboardManifestOptions {
  /** Project root; defaults to Vite's `config.root`. */
  root?: string;
  /** Scan patterns; defaults to `["src/**\/*.vue", "src/**\/*.ts"]`. */
  include?: string[];
  /** Warning sink for duplicate names / truncation (plugin passes its logger). */
  warn?: (message: string) => void;
}

export interface TraceboardVitePlugin {
  name: string;
  [key: string]: any;
}

/** Scan the project for shallow function facts (name -> file + 1-based line). */
export declare function scanFunctions(options?: TraceboardManifestOptions): Promise<TraceboardManifest>;

/** Vite plugin factory (default export). */
export declare function traceboardManifest(options?: TraceboardManifestOptions): TraceboardVitePlugin;

/** Guide alias for the default factory. */
export declare const traceboardShallow: typeof traceboardManifest;

export default traceboardManifest;