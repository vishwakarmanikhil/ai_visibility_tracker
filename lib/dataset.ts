import { buildConfig, type TrackerFile } from "./config";
import { dedupe, parseResponses } from "./load";
import { analyzeAll } from "./analyze";
import type { AnalyzedResponse, Config, DataIssue, ResponseRecord } from "./types";

/**
 * Turning data-pack files into a full analysis. Pure (no file system), so the same code
 * runs on the server (reading the data folder) and in the browser (files the user uploads).
 */

export interface DataFile {
  /** File name; folders are ignored, so "pack/brands.json" works too. */
  name: string;
  content: string;
}

export interface Analysis {
  config: Config;
  responses: AnalyzedResponse[];
  issues: DataIssue[];
}

export const REQUIRED_FILES = ["brands.json", "prompts.csv"] as const;

const base = (name: string) => name.split(/[\\/]/).pop()!.toLowerCase();
const isResponseFile = (name: string) => base(name).endsWith(".jsonl") || /^responses.*\.json$/.test(base(name));

/** Which required pieces are missing from a set of files (empty list = good to go). */
export function missingFiles(files: { name: string }[]): string[] {
  const names = new Set(files.map((f) => base(f.name)));
  const missing: string[] = REQUIRED_FILES.filter((r) => !names.has(r));
  if (!files.some((f) => isResponseFile(f.name))) missing.push("responses (.jsonl)");
  return missing;
}

export function analysisFromFiles(files: DataFile[], tracker: TrackerFile, dataDir = "uploaded files"): Analysis {
  const missing = missingFiles(files);
  if (missing.length) throw new Error(`Data pack is incomplete: missing ${missing.join(", ")}.`);
  const find = (n: string) => files.find((f) => base(f.name) === n)?.content;
  const config = buildConfig(tracker, { brandsJson: find("brands.json")!, factsJson: find("facts.json"), promptsCsv: find("prompts.csv")! }, dataDir);

  const issues: DataIssue[] = [];
  const records: ResponseRecord[] = [];
  const formats = new Set<string>();
  for (const f of files.filter((x) => isResponseFile(x.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const parsed = parseResponses(f.content, base(f.name));
    records.push(...parsed.records);
    parsed.formats.forEach((x) => formats.add(x));
    if (parsed.badLines) issues.push({ kind: "unreadable_rows", detail: `${base(f.name)}: rows that could not be read`, count: parsed.badLines });
  }
  const { responses, issues: more } = dedupe(records, issues, formats);
  return { config, responses: analyzeAll(responses, config), issues: more };
}
