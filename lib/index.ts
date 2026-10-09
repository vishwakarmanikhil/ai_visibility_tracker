import fs from "node:fs";
import path from "node:path";
import type { TrackerFile } from "./config";
import { analysisFromFiles, missingFiles, type Analysis, type DataFile } from "./dataset";

/** Server side: read the data folder from disk and analyse it (used by the CLI, tests and server-rendered pages). */

let cache: { signature: string; analysis: Analysis } | null = null;

export function readTracker(rootDir = process.cwd()): TrackerFile {
  const p = path.join(rootDir, "config", "tracker.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

export function dataDirFor(rootDir = process.cwd()): string {
  return path.resolve(rootDir, process.env.DATA_DIR ?? readTracker(rootDir).dataDir ?? "data");
}

function dataFiles(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir).filter((f) => /\.(jsonl?|csv)$/i.test(f));
}

/** True when the server has a usable data folder; otherwise the app asks the viewer to load the data pack in the browser. */
export function serverHasData(rootDir = process.cwd()): boolean {
  return missingFiles(dataFiles(dataDirFor(rootDir)).map((name) => ({ name }))).length === 0;
}

/** Load, clean and analyse the data folder. Cached until a data or config file changes, so new weeks show up without a restart. */
export function getAnalysis(rootDir = process.cwd()): Analysis {
  const dataDir = dataDirFor(rootDir);
  const names = dataFiles(dataDir);
  if (missingFiles(names.map((name) => ({ name }))).length)
    throw new Error(
      `Data pack not found in ${dataDir}. Unzip the data pack there (it needs brands.json, facts.json, prompts.csv and the responses .jsonl files), or set DATA_DIR. See README "Run it".`,
    );
  const trackerPath = path.join(rootDir, "config", "tracker.json");
  const signature = [trackerPath, ...names.map((n) => path.join(dataDir, n))]
    .filter((f) => fs.existsSync(f))
    .map((f) => `${f}:${fs.statSync(f).mtimeMs}`)
    .join("|");
  if (cache && cache.signature === signature) return cache.analysis;
  const files: DataFile[] = names.map((name) => ({ name, content: fs.readFileSync(path.join(dataDir, name), "utf8") }));
  const analysis = analysisFromFiles(files, readTracker(rootDir), dataDir);
  cache = { signature, analysis };
  return analysis;
}

/** Same as getAnalysis, but returns null instead of throwing when there is no data folder. */
export function tryGetAnalysis(rootDir = process.cwd()): Analysis | null {
  return serverHasData(rootDir) ? getAnalysis(rootDir) : null;
}

export type { Analysis, DataFile } from "./dataset";
export * from "./types";
