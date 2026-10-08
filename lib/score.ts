import type { AnalyzedResponse, Config, Prompt, Tone } from "./types";

/**
 * VISIBILITY SCORE (0-100), per company per week.
 *
 * Every answer earns a company points: 100 if the AI recommends it, 50 if it is just named,
 * 25 if it is criticised, 0 if the AI advises against it or leaves it out. We average those
 * points for each question on each engine (the two runs), then take a weighted average over
 * all questions x engines, where priority-3 questions count three times as much as priority-1.
 *
 * Read it as: "out of a possible 100, how well do AI answers to our buyers' questions treat us?"
 *
 * Missing data: if a question/engine wasn't collected in a week (e.g. Perplexity in week 5),
 * we carry forward its last known value and flag the week as partial, so a gap can never
 * show up as a drop.
 *
 * Noise: each question is asked twice per engine per week. How much run 1 and run 2 disagree
 * tells us how much the score moves by pure chance. A week-on-week change only counts as
 * real if it is larger than about two standard errors of that chance movement.
 */

export interface Cell {
  week: number;
  engine: string;
  promptId: string;
  /** Points per run (0-100) for each brand. */
  runs: Map<string, number[]>;
  mentionedBy: Set<string>;
}

export interface WeekScore {
  week: number;
  score: number | null;
  /** Share of expected question/engine slots actually collected this week (0-1). */
  coverage: number;
  missingEngines: string[];
  change: number | null;
  /** Standard error of the change, from run-to-run variation. */
  changeSE: number | null;
  verdict: "up" | "down" | "steady" | "first" | "n/a";
  mentionRate: number;
  recommendRate: number;
  avgPosition: number | null;
  firstPlaceRate: number;
  answers: number;
}

export interface Driver {
  promptId: string;
  engine: string;
  /** Contribution of this question/engine to the overall score change, in points. */
  contribution: number;
  before: number;
  after: number;
}

export interface BrandSeries {
  brand: string;
  weeks: WeekScore[];
  noiseSD: number;
}

export interface Model {
  weeks: number[];
  engines: string[];
  prompts: Prompt[];
  cells: Map<string, Cell>;
  series: Map<string, BrandSeries>;
  credit: Record<Tone, number>;
}

export const cellKey = (week: number, engine: string, promptId: string) => `${week}|${engine}|${promptId}`;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function points(tone: Tone | null, credit: Record<Tone, number>): number {
  return tone === null ? 0 : credit[tone];
}

export function buildModel(responses: AnalyzedResponse[], config: Config): Model {
  const ok = responses.filter((r) => !r.failed);
  const weeks = [...new Set(ok.map((r) => r.week))].sort((a, b) => a - b);
  const engines = [...new Set(ok.map((r) => r.engine))].sort();
  const prompts = [...config.prompts];
  for (const id of new Set(ok.map((r) => r.promptId)))
    if (!prompts.some((p) => p.id === id)) prompts.push({ id, question: id, stage: "unknown", priority: 1 });

  const cells = new Map<string, Cell>();
  for (const r of ok) {
    const k = cellKey(r.week, r.engine, r.promptId);
    if (!cells.has(k)) cells.set(k, { week: r.week, engine: r.engine, promptId: r.promptId, runs: new Map(), mentionedBy: new Set() });
    const cell = cells.get(k)!;
    for (const b of r.results) {
      if (!cell.runs.has(b.brand)) cell.runs.set(b.brand, []);
      cell.runs.get(b.brand)!.push(b.mentioned ? points(b.tone, config.toneCredit) : 0);
      if (b.mentioned) cell.mentionedBy.add(b.brand);
    }
  }

  const series = new Map<string, BrandSeries>();
  for (const brand of config.brands) series.set(brand.key, brandSeries(brand.key, ok, weeks, engines, prompts, cells));
  const model: Model = { weeks, engines, prompts, cells, series, credit: config.toneCredit };
  // Week-on-week changes are like-for-like: only questions/engines collected in both weeks.
  for (const s of series.values())
    for (const [i, ws] of s.weeks.entries()) {
      if (i === 0) continue;
      const c = compare(model, s.brand, [weeks[i - 1]], [ws.week]);
      Object.assign(ws, { change: c.change, changeSE: c.se, verdict: c.verdict });
    }
  return model;
}

interface Slot {
  value: number;
  runs: number;
  /** Week the value really comes from (differs from the week asked for when carried forward). */
  from: number;
}

/** Value for a question/engine in a week, carrying forward the last collected week if missing. */
export function slotValue(cells: Map<string, Cell>, brand: string, week: number, engine: string, promptId: string, weeks: number[]): Slot | null {
  for (let i = weeks.indexOf(week); i >= 0; i--) {
    const c = cells.get(cellKey(weeks[i], engine, promptId));
    const runs = c?.runs.get(brand);
    if (runs?.length) return { value: mean(runs), runs: runs.length, from: weeks[i] };
  }
  return null;
}

function brandSeries(
  brand: string,
  responses: AnalyzedResponse[],
  weeks: number[],
  engines: string[],
  prompts: Prompt[],
  cells: Map<string, Cell>,
): BrandSeries {
  // Pooled run-to-run variance: for a pair of runs, E[(r1 - r2)^2] / 2 estimates one run's variance.
  const sq: number[] = [];
  for (const c of cells.values()) {
    const r = c.runs.get(brand);
    if (r && r.length >= 2) sq.push((r[0] - r[1]) ** 2 / 2);
  }
  const variance = sq.length ? mean(sq) : 0;

  const out: WeekScore[] = [];
  for (const [wi, week] of weeks.entries()) {
    let num = 0;
    let den = 0;
    let observed = 0;
    const engineSeen = new Set<string>();
    for (const e of engines)
      for (const p of prompts) {
        const s = slotValue(cells, brand, week, e, p.id, weeks);
        if (!s) continue;
        num += p.priority * s.value;
        den += p.priority;
        if (s.from === week) {
          observed++;
          engineSeen.add(e);
        }
      }

    const weekAnswers = responses.filter((r) => r.week === week);
    const res = weekAnswers.map((r) => r.results.find((x) => x.brand === brand)!).filter(Boolean);
    const mentioned = res.filter((x) => x.mentioned);
    out.push({
      week,
      score: den ? num / den : null,
      coverage: observed / (engines.length * prompts.length),
      missingEngines: engines.filter((e) => !engineSeen.has(e)),
      change: null,
      changeSE: null,
      verdict: wi === 0 ? "first" : "n/a",
      mentionRate: res.length ? mentioned.length / res.length : 0,
      recommendRate: res.length ? mentioned.filter((x) => x.tone === "recommended").length / res.length : 0,
      avgPosition: mentioned.length ? mean(mentioned.map((x) => x.position!)) : null,
      firstPlaceRate: res.length ? mentioned.filter((x) => x.position === 1).length / res.length : 0,
      answers: res.length,
    });
  }
  return { brand, weeks: out, noiseSD: Math.sqrt(variance) };
}

export interface Comparison {
  before: number | null;
  after: number | null;
  change: number | null;
  se: number | null;
  verdict: "up" | "down" | "steady" | "n/a";
  /** Question/engine slots that were collected in both periods (like-for-like). */
  slots: number;
}

export function verdictFor(change: number | null, se: number | null): Comparison["verdict"] {
  if (change === null || se === null) return "n/a";
  if (Math.abs(change) > 2 * se && Math.abs(change) >= 0.5) return change > 0 ? "up" : "down";
  return "steady";
}

/**
 * Like-for-like comparison of a brand between two sets of weeks (e.g. [5] vs [6], or [3,4] vs [5,6]),
 * optionally restricted to some engines/questions. Only slots collected in both periods count,
 * so a missing engine can't masquerade as a drop. The standard error comes from the brand's
 * run-to-run variance, scaled by how many runs back each slot.
 */
export function compare(model: Model, brand: string, weeksA: number[], weeksB: number[], filter: (engine: string, prompt: Prompt) => boolean = () => true): Comparison {
  const sd = model.series.get(brand)?.noiseSD ?? 0;
  const variance = sd * sd;
  const period = (weeks: number[], e: string, p: string) => {
    const runs = weeks.flatMap((w) => model.cells.get(cellKey(w, e, p))?.runs.get(brand) ?? []);
    return runs.length ? { value: mean(runs), runs: runs.length } : null;
  };
  let a = 0;
  let b = 0;
  let v = 0;
  let w = 0;
  let slots = 0;
  for (const e of model.engines)
    for (const p of model.prompts) {
      if (!filter(e, p)) continue;
      const pa = period(weeksA, e, p.id);
      const pb = period(weeksB, e, p.id);
      if (!pa || !pb) continue;
      slots++;
      w += p.priority;
      a += p.priority * pa.value;
      b += p.priority * pb.value;
      v += p.priority ** 2 * (variance / pa.runs + variance / pb.runs);
    }
  if (!w) return { before: null, after: null, change: null, se: null, verdict: "n/a", slots: 0 };
  const change = (b - a) / w;
  const se = Math.sqrt(v) / w;
  return { before: a / w, after: b / w, change, se, verdict: verdictFor(change, se), slots };
}

/** Which question/engine slots moved a brand's score between two weeks, biggest first. */
export function drivers(model: Model, brand: string, week: number): Driver[] {
  const wi = model.weeks.indexOf(week);
  if (wi <= 0) return [];
  const prev = model.weeks[wi - 1];
  const totalWeight = model.engines.length * model.prompts.reduce((a, p) => a + p.priority, 0);
  const out: Driver[] = [];
  for (const e of model.engines)
    for (const p of model.prompts) {
      const a = slotValue(model.cells, brand, week, e, p.id, model.weeks);
      const b = slotValue(model.cells, brand, prev, e, p.id, model.weeks);
      if (!a || !b || a.from === b.from || a.value === b.value) continue;
      out.push({ promptId: p.id, engine: e, contribution: (p.priority * (a.value - b.value)) / totalWeight, before: b.value, after: a.value });
    }
  return out.sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
}

/** Score for a brand restricted to a subset of slots (e.g. one engine, or one buying stage). */
export function subsetScore(model: Model, brand: string, week: number, filter: (engine: string, prompt: Prompt) => boolean): number | null {
  let num = 0;
  let den = 0;
  for (const e of model.engines)
    for (const p of model.prompts) {
      if (!filter(e, p)) continue;
      const s = slotValue(model.cells, brand, week, e, p.id, model.weeks);
      if (!s) continue;
      num += p.priority * s.value;
      den += p.priority;
    }
  return den ? num / den : null;
}

export interface HeadToHeadCell {
  promptId: string;
  engine: string;
  winner: string | null;
  values: Record<string, number>;
  carried: boolean;
}

/** For every question on every engine: which company the AI treats best (highest points). */
export function headToHead(model: Model, brands: string[], week: number): HeadToHeadCell[] {
  const out: HeadToHeadCell[] = [];
  for (const p of model.prompts)
    for (const e of model.engines) {
      const values: Record<string, number> = {};
      let carried = false;
      for (const b of brands) {
        const s = slotValue(model.cells, b, week, e, p.id, model.weeks);
        if (s) {
          values[b] = s.value;
          if (s.from !== week) carried = true;
        }
      }
      const best = Object.entries(values).sort((a, b) => b[1] - a[1]);
      const winner = best.length && best[0][1] > 0 && (best.length === 1 || best[0][1] > best[1][1]) ? best[0][0] : null;
      out.push({ promptId: p.id, engine: e, winner, values, carried });
    }
  return out;
}

export interface Displacement {
  promptId: string;
  engine: string;
  lost: string;
  takenBy: string[];
}

/**
 * When a company appeared in a question/engine slot last week but in neither run this week,
 * which companies appeared in its place (named this week but not last week)?
 */
export function displacements(model: Model, week: number, brands: string[]): Displacement[] {
  const wi = model.weeks.indexOf(week);
  if (wi <= 0) return [];
  const prev = model.weeks[wi - 1];
  const out: Displacement[] = [];
  for (const p of model.prompts)
    for (const e of model.engines) {
      const now = model.cells.get(cellKey(week, e, p.id));
      const before = model.cells.get(cellKey(prev, e, p.id));
      if (!now || !before) continue;
      for (const b of brands) {
        if (before.mentionedBy.has(b) && !now.mentionedBy.has(b)) {
          const takenBy = [...now.mentionedBy].filter((x) => !before.mentionedBy.has(x));
          out.push({ promptId: p.id, engine: e, lost: b, takenBy });
        }
      }
    }
  return out;
}
