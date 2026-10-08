export type Tone = "recommended" | "neutral" | "negative" | "not_recommended";

export const TONES: Tone[] = ["recommended", "neutral", "negative", "not_recommended"];

export type BrandRole = "client" | "tracked" | "other";

export interface Brand {
  key: string;
  name: string;
  website: string;
  /** Role in the brands.json file (the configured client may differ when viewing from a competitor's side). */
  role: BrandRole;
  aliases: string[];
  notThisBrandWhenFollowedBy: string[];
}

export interface Prompt {
  id: string;
  question: string;
  stage: string;
  priority: number;
}

export interface BrandFacts {
  name?: string;
  website?: string;
  starting_price_usd?: number;
  price_unit?: string;
  hq?: string;
  founded?: number;
  features?: Record<string, boolean>;
  integrations?: string[];
}

export interface Config {
  dataDir: string;
  client: string;
  brands: Brand[];
  prompts: Prompt[];
  facts: Record<string, BrandFacts>;
  toneCredit: Record<Tone, number>;
  knownIntegrations: string[];
}

/** One AI answer after cleaning: every input format is mapped onto this shape. */
export interface ResponseRecord {
  id: string;
  week: number;
  engine: string;
  promptId: string;
  run: number;
  collectedAt: string | null;
  text: string;
  citations: string[];
  failed: boolean;
  sourceFile: string;
}

export interface DataIssue {
  kind: string;
  detail: string;
  count: number;
}

export interface LoadResult {
  responses: ResponseRecord[];
  issues: DataIssue[];
}

export interface MentionSpan {
  brand: string;
  start: number;
  end: number;
  text: string;
  fuzzy: boolean;
}

export interface BrandResult {
  brand: string;
  mentioned: boolean;
  position: number | null;
  tone: Tone | null;
  /** The sentence that decided the tone, for explainability in the UI. */
  toneEvidence: string | null;
}

export interface WrongFact {
  responseId: string;
  brand: string;
  factKey: string;
  claimText: string;
  expected: string;
  claimed: string;
}

export interface AnalyzedResponse extends ResponseRecord {
  spans: MentionSpan[];
  results: BrandResult[];
  wrongFacts: WrongFact[];
}
