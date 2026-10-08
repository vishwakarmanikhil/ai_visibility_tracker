import type { Analysis } from "./index";
import type { Brand, Prompt, WrongFact } from "./types";
import { buildModel, compare, displacements, drivers, headToHead, subsetScore, type Comparison, type Model } from "./score";
import { sourceStats } from "./sources";

export const ENGINE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  google_ai_overview: "Google AI Overviews",
  gemini: "Gemini",
  claude: "Claude",
  copilot: "Copilot",
};
export const engineLabel = (e: string) => ENGINE_LABELS[e] ?? e;

export const STAGE_LABELS: Record<string, string> = {
  early_research: "Early research",
  comparing_options: "Comparing options",
  specific_company: "Asking about a company",
};
export const stageLabel = (s: string) => STAGE_LABELS[s] ?? s.replace(/_/g, " ");

const FACT_LABELS: Record<string, string> = {
  starting_price_usd: "Starting price",
  hq: "Headquarters",
  founded: "Founding year",
  integrations: "Integrations",
};
export function factLabel(key: string): string {
  if (FACT_LABELS[key]) return FACT_LABELS[key];
  const f = key.replace(/^features\./, "").replace(/_/g, " ");
  return key.startsWith("features.") ? `Feature: ${f}` : f;
}

export interface ScoreCard {
  brand: Brand;
  score: number | null;
  weekly: Comparison;
  trend: Comparison;
  history: { week: number; score: number | null; partial: boolean }[];
  mentionRate: number;
  recommendRate: number;
  avgPosition: number | null;
}

export interface EngineMove {
  engine: string;
  brand: string;
  weekly: Comparison;
  trend: Comparison;
}

export interface FactAlert {
  brand: string;
  factKey: string;
  expected: string;
  claimed: string[];
  total: number;
  thisWeek: number;
  engines: string[];
  examples: (WrongFact & { week: number; engine: string; promptId: string })[];
}

export interface Briefing {
  client: Brand;
  week: number;
  prevWeek: number | null;
  trendWindow: { before: number[]; after: number[] } | null;
  partial: { missingEngines: string[]; coverage: number } | null;
  cards: ScoreCard[];
  headline: string;
  why: string[];
  whoMoved: string[];
  engineMoves: EngineMove[];
  alerts: FactAlert[];
  actions: string[];
  model: Model;
}

const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? "–" : n.toFixed(d));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;

export function describeChange(c: Comparison): string {
  if (c.change === null) return "no comparable data";
  if (c.verdict === "steady") return `${signed(c.change)}, within normal run-to-run variation (±${fmt(2 * (c.se ?? 0), 1)})`;
  return `${signed(c.change)}, a real ${c.verdict === "up" ? "rise" : "drop"} (bigger than the ±${fmt(2 * (c.se ?? 0), 1)} normal variation)`;
}

/** Trend window: the latest two weeks vs the two before them (or the closest we have). */
function trendWindow(weeks: number[], week: number): { before: number[]; after: number[] } | null {
  const i = weeks.indexOf(week);
  if (i < 1) return null;
  if (i < 3) return { before: [weeks[0]], after: [week] };
  return { before: [weeks[i - 3], weeks[i - 2]], after: [weeks[i - 1], week] };
}

export function buildBriefing(analysis: Analysis, clientKey: string, requestedWeek?: number): Briefing {
  const { config, responses } = analysis;
  const model = buildModel(responses, config);
  const week = requestedWeek && model.weeks.includes(requestedWeek) ? requestedWeek : model.weeks[model.weeks.length - 1];
  const wi = model.weeks.indexOf(week);
  const prevWeek = wi > 0 ? model.weeks[wi - 1] : null;
  const tw = trendWindow(model.weeks, week);
  const client = config.brands.find((b) => b.key === clientKey) ?? config.brands[0];
  const tracked = [client, ...config.brands.filter((b) => b.role !== "other" && b.key !== client.key)];
  const promptById = new Map(model.prompts.map((p) => [p.id, p]));

  const cards: ScoreCard[] = tracked.map((brand) => {
    const s = model.series.get(brand.key)!;
    const ws = s.weeks.find((w) => w.week === week)!;
    return {
      brand,
      score: ws.score,
      weekly: prevWeek !== null ? compare(model, brand.key, [prevWeek], [week]) : nullComparison(),
      trend: tw ? compare(model, brand.key, tw.before, tw.after) : nullComparison(),
      history: s.weeks.filter((w) => w.week <= week).map((w) => ({ week: w.week, score: w.score, partial: w.missingEngines.length > 0 })),
      mentionRate: ws.mentionRate,
      recommendRate: ws.recommendRate,
      avgPosition: ws.avgPosition,
    };
  });
  const clientCard = cards[0];
  const ws = model.series.get(client.key)!.weeks.find((w) => w.week === week)!;
  const partial = ws.missingEngines.length ? { missingEngines: ws.missingEngines, coverage: ws.coverage } : null;

  // Per-engine movement for every tracked brand: this is where the real story usually is.
  const engineMoves: EngineMove[] = [];
  for (const b of tracked)
    for (const e of model.engines)
      engineMoves.push({
        engine: e,
        brand: b.key,
        weekly: prevWeek !== null ? compare(model, b.key, [prevWeek], [week], (en) => en === e) : nullComparison(),
        trend: tw ? compare(model, b.key, tw.before, tw.after, (en) => en === e) : nullComparison(),
      });

  const why = explainWhy(model, client, week, prevWeek, clientCard, engineMoves, promptById, partial);
  const whoMoved = explainWhoMoved(model, client, tracked, week, engineMoves, config.brands);
  const alerts = factAlerts(analysis, tracked.map((b) => b.key), week);
  const actions = suggestActions(analysis, model, client, week, engineMoves, alerts, promptById);

  const name = client.name;
  let headline = `${name} scores ${fmt(clientCard.score)} out of 100 in week ${week}`;
  const rank = [...cards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).findIndex((c) => c.brand.key === client.key) + 1;
  headline += ` (${ordinal(rank)} of ${cards.length} tracked companies).`;
  const realDrops = engineMoves.filter((m) => m.brand === client.key && (m.weekly.verdict === "down" || m.trend.verdict === "down"));
  const realRises = engineMoves.filter((m) => m.brand === client.key && (m.weekly.verdict === "up" || m.trend.verdict === "up"));
  if (clientCard.weekly.verdict === "down" || clientCard.trend.verdict === "down") headline += " We are losing ground.";
  else if (clientCard.weekly.verdict === "up" || clientCard.trend.verdict === "up") headline += " We are gaining ground.";
  else if (realDrops.length) headline += ` Overall steady, but we are losing ground on ${realDrops.map((m) => engineLabel(m.engine)).join(" and ")}.`;
  else if (realRises.length) headline += ` Overall steady, with real gains on ${realRises.map((m) => engineLabel(m.engine)).join(" and ")}.`;
  else headline += " No real change this week.";

  return { client, week, prevWeek, trendWindow: tw, partial, cards, headline, why, whoMoved, engineMoves, alerts, actions, model };
}

function nullComparison(): Comparison {
  return { before: null, after: null, change: null, se: null, verdict: "n/a", slots: 0 };
}

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd"][n - 1] ?? `${n}th`;
}

function explainWhy(
  model: Model,
  client: Brand,
  week: number,
  prevWeek: number | null,
  card: ScoreCard,
  moves: EngineMove[],
  promptById: Map<string, Prompt>,
  partial: Briefing["partial"],
): string[] {
  const out: string[] = [];
  if (prevWeek === null) return ["This is the first week of data, so there is nothing to compare against yet."];
  out.push(`Versus week ${prevWeek}: ${describeChange(card.weekly)}.`);
  if (card.trend.change !== null) out.push(`Last two weeks vs the two before: ${describeChange(card.trend)}.`);
  if (partial)
    out.push(
      `Week ${week} is incomplete: no answers were collected from ${partial.missingEngines.map(engineLabel).join(", ")}. Changes are compared only on what was collected in both weeks, and the score carries those engines' last known results forward, so the gap does not show up as a drop.`,
    );
  for (const m of moves.filter((x) => x.brand === client.key)) {
    const c = m.weekly.verdict === "up" || m.weekly.verdict === "down" ? m.weekly : m.trend.verdict === "up" || m.trend.verdict === "down" ? m.trend : null;
    if (!c) continue;
    const span = c === m.weekly ? `since week ${prevWeek}` : "over the last two weeks";
    out.push(`${engineLabel(m.engine)}: ${c.verdict === "down" ? "down" : "up"} from ${fmt(c.before)} to ${fmt(c.after)} ${span}. This is a real change, not noise.`);
  }
  const d = drivers(model, client.key, week).slice(0, 3);
  for (const x of d) {
    const q = promptById.get(x.promptId)?.question ?? x.promptId;
    const what =
      x.after === 0 ? "no longer mentioned" : x.before === 0 ? "now mentioned" : x.after > x.before ? "treated more favourably" : "treated less favourably";
    out.push(`Biggest single move: "${q}" on ${engineLabel(x.engine)}, ${what} (${fmt(x.before)} → ${fmt(x.after)} points). One question can swing by chance, so read this alongside the engine trends.`);
  }
  return out;
}

function explainWhoMoved(model: Model, client: Brand, tracked: Brand[], week: number, moves: EngineMove[], all: Brand[]): string[] {
  const out: string[] = [];
  const name = (k: string) => all.find((b) => b.key === k)?.name ?? k;
  for (const b of tracked.slice(1)) {
    const real = moves.filter((m) => m.brand === b.key && ((m.weekly.verdict !== "steady" && m.weekly.verdict !== "n/a") || (m.trend.verdict !== "steady" && m.trend.verdict !== "n/a")));
    for (const m of real) {
      const c = m.trend.verdict === "up" || m.trend.verdict === "down" ? m.trend : m.weekly;
      out.push(`${b.name} is ${c.verdict === "up" ? "gaining" : "losing"} ground on ${engineLabel(m.engine)}: ${fmt(c.before)} → ${fmt(c.after)}.`);
    }
  }
  // Where the client lost a question/engine slot, who appeared instead?
  const disp = displacements(model, week, [client.key]);
  if (disp.length) {
    const takers = new Map<string, number>();
    for (const d of disp) for (const t of d.takenBy) takers.set(t, (takers.get(t) ?? 0) + 1);
    const top = [...takers.entries()].sort((a, b) => b[1] - a[1]);
    out.push(
      `${client.name} dropped out of ${disp.length} question/engine slot${disp.length === 1 ? "" : "s"} it held last week.` +
        (top.length ? ` Who appeared instead: ${top.map(([k, n]) => `${name(k)} (${n})`).join(", ")}.` : " No new company replaced it."),
    );
  }
  // Same, but for client losses on an engine trend.
  for (const m of moves.filter((x) => x.brand === client.key && (x.trend.verdict === "down" || x.weekly.verdict === "down"))) {
    const gainers = moves
      .filter((x) => x.engine === m.engine && x.brand !== client.key && (x.trend.change ?? 0) > 0)
      .sort((a, b) => (b.trend.change ?? 0) - (a.trend.change ?? 0));
    if (gainers.length)
      out.push(`On ${engineLabel(m.engine)}, where ${client.name} fell, ${gainers.map((g) => `${name(g.brand)} rose ${fmt(g.trend.change, 1)}`).join(", ")} over the same two weeks.`);
  }
  if (!out.length) out.push("No competitor made a move bigger than normal variation this week.");
  return out;
}

export function factAlerts(analysis: Analysis, brands: string[], week: number): FactAlert[] {
  const byKey = new Map<string, FactAlert>();
  for (const r of analysis.responses) {
    if (r.week > week) continue;
    for (const f of r.wrongFacts) {
      if (!brands.includes(f.brand)) continue;
      const k = `${f.brand}|${f.factKey}`;
      if (!byKey.has(k)) byKey.set(k, { brand: f.brand, factKey: f.factKey, expected: f.expected, claimed: [], total: 0, thisWeek: 0, engines: [], examples: [] });
      const a = byKey.get(k)!;
      a.total++;
      if (r.week === week) a.thisWeek++;
      if (!a.claimed.includes(f.claimed)) a.claimed.push(f.claimed);
      if (!a.engines.includes(r.engine)) a.engines.push(r.engine);
      a.examples.push({ ...f, week: r.week, engine: r.engine, promptId: r.promptId });
    }
  }
  for (const a of byKey.values()) a.examples.sort((x, y) => y.week - x.week);
  // Client first, then most recent / most frequent.
  return [...byKey.values()].sort((a, b) => Number(b.brand === brands[0]) - Number(a.brand === brands[0]) || b.thisWeek - a.thisWeek || b.total - a.total);
}

function suggestActions(
  analysis: Analysis,
  model: Model,
  client: Brand,
  week: number,
  moves: EngineMove[],
  alerts: FactAlert[],
  promptById: Map<string, Prompt>,
): string[] {
  const out: string[] = [];
  const name = (k: string) => analysis.config.brands.find((b) => b.key === k)?.name ?? k;

  const own = alerts.filter((a) => a.brand === client.key && a.thisWeek > 0);
  if (own.length) {
    const list = own.map((a) => `${factLabel(a.factKey).toLowerCase()} (AI says ${a.claimed.join(" / ")}; truth: ${a.expected})`).join("; ");
    out.push(`Fix what AI gets wrong about us: ${list}. State these facts plainly on our website (pricing, about and feature pages) and in our G2/Capterra profiles. Brief sales so they can correct prospects.`);
  }

  const drops = moves.filter((m) => m.brand === client.key && (m.trend.verdict === "down" || m.weekly.verdict === "down"));
  const stats = sourceStats(analysis.responses, analysis.config, client.key, model.weeks.filter((w) => w <= week).slice(-2));
  for (const d of drops) {
    const engineSources = stats.filter((s) => s.gap && s.engines.includes(d.engine)).slice(0, 3).map((s) => s.domain);
    out.push(
      `Investigate ${engineLabel(d.engine)}: our score there fell from ${fmt((d.trend.verdict === "down" ? d.trend : d.weekly).before)} to ${fmt((d.trend.verdict === "down" ? d.trend : d.weekly).after)}.` +
        (engineSources.length ? ` It is citing ${engineSources.join(", ")} for competitors but never for us; get Corvane covered there.` : ""),
    );
  }

  // High-priority questions where we are weak and a competitor wins.
  const h2h = headToHead(model, analysis.config.brands.map((b) => b.key), week);
  const weak = model.prompts
    .filter((p) => p.priority >= 2)
    .map((p) => ({ p, score: subsetScore(model, client.key, week, (_, pp) => pp.id === p.id) ?? 0, winners: h2h.filter((c) => c.promptId === p.id && c.winner && c.winner !== client.key).map((c) => c.winner!) }))
    .filter((x) => x.score < 30 && x.winners.length >= 2)
    .sort((a, b) => b.p.priority - a.p.priority || a.score - b.score)
    .slice(0, 2);
  for (const w of weak) {
    const top = mode(w.winners);
    out.push(`Win back "${w.p.question}" (priority ${w.p.priority}): we score ${fmt(w.score)} and ${name(top)} is the AI's usual pick. Publish a focused page that answers this question directly, with our pricing and proof points.`);
  }

  const gaps = stats.filter((s) => s.gap).slice(0, 3);
  if (gaps.length && !drops.length)
    out.push(`Get listed or reviewed on ${gaps.map((g) => g.domain).join(", ")}. AI engines cite these sites when recommending competitors, but never when mentioning us.`);

  const comp = alerts.filter((a) => a.brand !== client.key && a.thisWeek > 0).slice(0, 2);
  for (const c of comp)
    out.push(`Sales talking point: AI is telling buyers the wrong ${factLabel(c.factKey).toLowerCase()} for ${name(c.brand)} (says ${c.claimed.join(" / ")}; truth: ${c.expected}).`);

  if (!out.length) out.push("Nothing urgent this week. Keep monitoring.");
  return out;
}

function mode(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
