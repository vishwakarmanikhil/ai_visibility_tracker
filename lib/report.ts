import type { Analysis } from "./dataset";
import { toCsv } from "./csv";
import { buildModel, compare, subsetScore } from "./score";
import { engineLabel, stageLabel } from "./insights";

/**
 * Board report: one row per week per tracked company, with the headline score, whether the
 * change was real, and the supporting rates, split by engine and buying stage. Opens in Excel / Sheets.
 */
export function boardReportCsv(analysis: Analysis): string {
  const { config, responses } = analysis;
  const model = buildModel(responses, config);
  const tracked = config.brands.filter((b) => b.role !== "other");
  const stages = [...new Set(model.prompts.map((p) => p.stage))];
  const header = [
    "week",
    "company",
    "visibility_score",
    "change_vs_previous_week",
    "change_is_real",
    "mentioned_in_pct_of_answers",
    "recommended_in_pct_of_answers",
    "average_position",
    "named_first_pct",
    "wrong_fact_claims",
    "answers_analysed",
    "engines_missing_this_week",
    ...model.engines.map((e) => `score_${engineLabel(e).toLowerCase().replace(/\W+/g, "_")}`),
    ...stages.map((s) => `score_${stageLabel(s).toLowerCase().replace(/\W+/g, "_")}`),
  ];
  const r1 = (n: number | null) => (n === null ? "" : n.toFixed(1));
  const rows: unknown[][] = [];
  for (const [i, week] of model.weeks.entries())
    for (const b of tracked) {
      const ws = model.series.get(b.key)!.weeks[i];
      const c = i > 0 ? compare(model, b.key, [model.weeks[i - 1]], [week]) : null;
      const wrong = responses.filter((r) => r.week === week).reduce((n, r) => n + r.wrongFacts.filter((f) => f.brand === b.key).length, 0);
      rows.push([
        week,
        b.name,
        r1(ws.score),
        c ? r1(c.change) : "",
        c ? (c.verdict === "up" || c.verdict === "down" ? "yes" : "no (within normal variation)") : "",
        (ws.mentionRate * 100).toFixed(0),
        (ws.recommendRate * 100).toFixed(0),
        ws.avgPosition === null ? "" : ws.avgPosition.toFixed(2),
        (ws.firstPlaceRate * 100).toFixed(0),
        wrong,
        ws.answers,
        ws.missingEngines.map(engineLabel).join("; "),
        ...model.engines.map((e) => r1(subsetScore(model, b.key, week, (en) => en === e))),
        ...stages.map((s) => r1(subsetScore(model, b.key, week, (_, p) => p.stage === s))),
      ]);
    }
  return toCsv(header, rows);
}
