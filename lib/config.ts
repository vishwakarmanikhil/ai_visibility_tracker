import fs from "node:fs";
import path from "node:path";
import type { Brand, BrandFacts, BrandRole, Config, Prompt, Tone } from "./types";
import { parseCsv } from "./csv";

interface RawBrand {
  name: string;
  website: string;
}

interface TrackerFile {
  dataDir?: string;
  client?: string;
  brands?: Record<string, { extraAliases?: string[]; notThisBrandWhenFollowedBy?: string[] }>;
  toneCredit?: Partial<Record<Tone, number>>;
  knownIntegrations?: string[];
}

const DEFAULT_CREDIT: Record<Tone, number> = {
  recommended: 100,
  neutral: 50,
  negative: 25,
  not_recommended: 0,
};

/** "Gridwell Systems" -> "gridwell", "Corvane Fleet" -> "corvane": the key used in the exports. */
export function brandKey(name: string): string {
  return name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildBrands(
  brandsJson: { client: RawBrand; tracked_competitors?: RawBrand[]; other_companies?: RawBrand[] },
  overrides: TrackerFile["brands"] = {},
): Brand[] {
  const entries: [RawBrand, BrandRole][] = [
    [brandsJson.client, "client"],
    ...(brandsJson.tracked_competitors ?? []).map((b): [RawBrand, BrandRole] => [b, "tracked"]),
    ...(brandsJson.other_companies ?? []).map((b): [RawBrand, BrandRole] => [b, "other"]),
  ];
  return entries.map(([raw, role]) => {
    const key = brandKey(raw.name);
    const o = overrides[key] ?? {};
    const domain = raw.website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const aliases = new Set<string>([raw.name, domain, domain.split(".")[0], ...(o.extraAliases ?? [])]);
    return {
      key,
      name: raw.name,
      website: domain,
      role,
      aliases: [...aliases],
      notThisBrandWhenFollowedBy: o.notThisBrandWhenFollowedBy ?? [],
    };
  });
}

export function parsePrompts(csvText: string): Prompt[] {
  const rows = parseCsv(csvText);
  return rows.map((r) => ({
    id: normalizePromptId(r.prompt_id ?? r.id ?? ""),
    question: r.question ?? r.prompt ?? "",
    stage: (r.stage ?? "unknown").trim(),
    priority: Number(r.priority) || 1,
  }));
}

/** "p1", "P01", " p01 " -> "P01" */
export function normalizePromptId(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  const m = s.match(/^P?0*(\d+)$/);
  return m ? `P${m[1].padStart(2, "0")}` : s;
}

export function loadConfig(rootDir = process.cwd(), clientOverride?: string): Config {
  const trackerPath = path.join(rootDir, "config", "tracker.json");
  const tracker: TrackerFile = fs.existsSync(trackerPath)
    ? JSON.parse(fs.readFileSync(trackerPath, "utf8"))
    : {};
  const dataDir = path.resolve(rootDir, process.env.DATA_DIR ?? tracker.dataDir ?? "data");
  const brandsJson = JSON.parse(fs.readFileSync(path.join(dataDir, "brands.json"), "utf8"));
  const factsPath = path.join(dataDir, "facts.json");
  const factsRaw = fs.existsSync(factsPath) ? JSON.parse(fs.readFileSync(factsPath, "utf8")) : {};
  const facts: Record<string, BrandFacts> = {};
  for (const [k, v] of Object.entries(factsRaw)) {
    if (!k.startsWith("_") && v && typeof v === "object") facts[k] = v as BrandFacts;
  }
  const brands = buildBrands(brandsJson, tracker.brands);
  const prompts = parsePrompts(fs.readFileSync(path.join(dataDir, "prompts.csv"), "utf8"));
  const requested = clientOverride ?? tracker.client ?? brands.find((b) => b.role === "client")?.key;
  const client = brands.some((b) => b.key === requested) ? requested! : brands[0].key;
  const knownIntegrations = new Set(tracker.knownIntegrations ?? []);
  for (const f of Object.values(facts)) for (const i of f.integrations ?? []) knownIntegrations.add(i);
  return {
    dataDir,
    client,
    brands,
    prompts,
    facts,
    toneCredit: { ...DEFAULT_CREDIT, ...tracker.toneCredit },
    knownIntegrations: [...knownIntegrations],
  };
}

/** Brands that get full tracking (scores, fact checks): the client plus tracked competitors. */
export function fullyTracked(config: Config): Brand[] {
  return config.brands.filter((b) => b.role !== "other");
}
