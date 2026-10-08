import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config";
import { loadResponses } from "./load";
import { analyzeAll } from "./analyze";
import type { AnalyzedResponse, Config, DataIssue } from "./types";

export interface Analysis {
  config: Config;
  responses: AnalyzedResponse[];
  issues: DataIssue[];
}

let cache: { signature: string; analysis: Analysis } | null = null;

/** Changes whenever a data or config file is added or edited, so new weeks show up without a restart. */
function signature(rootDir: string, dataDir: string): string {
  const files = [path.join(rootDir, "config", "tracker.json"), ...fs.readdirSync(dataDir).map((f) => path.join(dataDir, f))];
  return files
    .filter((f) => fs.existsSync(f))
    .map((f) => `${f}:${fs.statSync(f).mtimeMs}`)
    .join("|");
}

/** Load, clean and analyse everything once; the brand perspective (client) is applied by the views. */
export function getAnalysis(rootDir = process.cwd()): Analysis {
  const config = loadConfig(rootDir);
  const sig = signature(rootDir, config.dataDir);
  if (cache && cache.signature === sig) return cache.analysis;
  const { responses, issues } = loadResponses(config.dataDir);
  const analysis = { config, responses: analyzeAll(responses, config), issues };
  cache = { signature: sig, analysis };
  return analysis;
}

export * from "./types";
