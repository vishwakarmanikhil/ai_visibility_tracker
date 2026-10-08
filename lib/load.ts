import fs from "node:fs";
import path from "node:path";
import type { DataIssue, LoadResult, ResponseRecord } from "./types";
import { normalizePromptId } from "./config";
import { decodeEntities } from "./text";

/**
 * Each field can arrive under several names: the weekly exports changed format over time
 * (week 4 used answer/sources/run_number/collected). New aliases can be added here.
 */
const FIELD_ALIASES = {
  id: ["response_id", "id", "responseId"],
  week: ["week", "week_number", "weekNumber"],
  engine: ["engine", "model", "platform", "source_engine"],
  promptId: ["prompt_id", "question_id", "promptId", "prompt"],
  run: ["run", "run_number", "runNumber", "run_no"],
  collectedAt: ["collected_at", "collected", "collectedAt", "timestamp", "date"],
  text: ["response_text", "answer", "text", "response", "content", "output"],
  citations: ["citations", "sources", "references", "links"],
  error: ["error", "status_error"],
} as const;

function pick(obj: Record<string, unknown>, names: readonly string[]): unknown {
  for (const n of names) if (obj[n] !== undefined) return obj[n];
  return undefined;
}

/** Map every spelling of an engine onto one id: "ChatGPT", "chat_gpt", "AI Overview" ... */
export function normalizeEngine(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return "unknown";
  if (s.includes("chatgpt") || s.includes("openai") || s.startsWith("gpt")) return "chatgpt";
  if (s.includes("perplexity")) return "perplexity";
  if (s.includes("overview") || s === "aio" || s === "google" || s.includes("googleai") || s.includes("sge"))
    return "google_ai_overview";
  if (s.includes("gemini")) return "gemini";
  if (s.includes("claude")) return "claude";
  if (s.includes("copilot") || s.includes("bing")) return "copilot";
  return s;
}

export function normalizeWeek(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Accepts ISO timestamps and "DD/MM/YYYY HH:mm" (day first unless that is impossible). */
export function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (slash) {
    let [a, b] = [Number(slash[1]), Number(slash[2])];
    const [day, month] = b > 12 ? [b, a] : [a, b];
    const iso = `${slash[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${(slash[4] ?? "00").padStart(2, "0")}:${slash[5] ?? "00"}:00Z`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function normalizeCitations(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/) : [raw];
  return list
    .map((c) => (typeof c === "string" ? c : (c as { url?: string })?.url ?? ""))
    .map((c) => c.trim())
    .filter(Boolean);
}

export function normalizeRecord(obj: Record<string, unknown>, sourceFile: string): ResponseRecord | null {
  const id = pick(obj, FIELD_ALIASES.id);
  const week = normalizeWeek(pick(obj, FIELD_ALIASES.week));
  if (!id || week === null) return null;
  const text = decodeEntities(String(pick(obj, FIELD_ALIASES.text) ?? ""));
  const error = pick(obj, FIELD_ALIASES.error);
  return {
    id: String(id),
    week,
    engine: normalizeEngine(pick(obj, FIELD_ALIASES.engine)),
    promptId: normalizePromptId(pick(obj, FIELD_ALIASES.promptId)),
    run: Number(pick(obj, FIELD_ALIASES.run)) || 1,
    collectedAt: normalizeDate(pick(obj, FIELD_ALIASES.collectedAt)),
    text,
    citations: normalizeCitations(pick(obj, FIELD_ALIASES.citations)),
    failed: Boolean(error) || text.trim() === "",
    sourceFile,
  };
}

/** Parse one file's content: JSON Lines, or a JSON array. Bad lines are reported, not fatal. */
export function parseResponses(content: string, sourceFile: string): { records: ResponseRecord[]; badLines: number; formats: Set<string> } {
  const records: ResponseRecord[] = [];
  const formats = new Set<string>();
  let badLines = 0;
  const trimmed = content.replace(/^﻿/, "").trim();
  let objects: unknown[] = [];
  if (trimmed.startsWith("[")) {
    try {
      objects = JSON.parse(trimmed);
    } catch {
      badLines++;
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        objects.push(JSON.parse(line));
      } catch {
        badLines++;
      }
    }
  }
  for (const o of objects) {
    if (!o || typeof o !== "object") {
      badLines++;
      continue;
    }
    formats.add(Object.keys(o).sort().filter((k) => k !== "error").join(","));
    const rec = normalizeRecord(o as Record<string, unknown>, sourceFile);
    if (rec) records.push(rec);
    else badLines++;
  }
  return { records, badLines, formats };
}

/**
 * Load every *.jsonl / responses*.json file in the data folder, so a new week can be
 * dropped in as a new file. Duplicates (same id, or same week/engine/prompt/run) keep the first copy.
 */
export function loadResponses(dataDir: string): LoadResult {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".jsonl") || /^responses.*\.json$/.test(f))
    .sort();
  const issues: DataIssue[] = [];
  const all: ResponseRecord[] = [];
  const formats = new Set<string>();
  for (const f of files) {
    const parsed = parseResponses(fs.readFileSync(path.join(dataDir, f), "utf8"), f);
    all.push(...parsed.records);
    parsed.formats.forEach((x) => formats.add(x));
    if (parsed.badLines) issues.push({ kind: "unreadable_rows", detail: `${f}: rows that could not be read`, count: parsed.badLines });
  }
  return dedupe(all, issues, formats);
}

export function dedupe(all: ResponseRecord[], issues: DataIssue[] = [], formats = new Set<string>()): LoadResult {
  const seenIds = new Set<string>();
  const seenSlots = new Set<string>();
  const responses: ResponseRecord[] = [];
  let dupIds = 0;
  let dupSlots = 0;
  for (const r of all) {
    const slot = `${r.week}|${r.engine}|${r.promptId}|${r.run}`;
    if (seenIds.has(r.id)) {
      dupIds++;
      continue;
    }
    if (seenSlots.has(slot) && !r.failed) {
      dupSlots++;
      continue;
    }
    seenIds.add(r.id);
    if (!r.failed) seenSlots.add(slot);
    responses.push(r);
  }
  if (formats.size > 1) issues.push({ kind: "mixed_formats", detail: "Files use different field names; all were mapped to one format", count: formats.size });
  if (dupIds) issues.push({ kind: "duplicate_rows", detail: "Exact duplicate answers (same response ID) removed", count: dupIds });
  if (dupSlots) issues.push({ kind: "duplicate_runs", detail: "Second copy of the same week/engine/question/run removed", count: dupSlots });
  const failed = responses.filter((r) => r.failed).length;
  if (failed) issues.push({ kind: "failed_answers", detail: "Answers that errored or came back empty (excluded from scores)", count: failed });
  return { responses, issues };
}
