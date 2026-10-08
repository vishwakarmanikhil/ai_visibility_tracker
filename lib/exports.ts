import type { AnalyzedResponse, Config } from "./types";
import { toCsv } from "./csv";

/** mentions.csv: exactly six rows per answer (one per company), in the brief's format. */
export function mentionsCsv(analyzed: AnalyzedResponse[]): string {
  const rows: unknown[][] = [];
  for (const r of analyzed)
    for (const b of r.results) rows.push([r.id, b.brand, b.mentioned ? "true" : "false", b.position ?? "", b.tone ?? ""]);
  return toCsv(["response_id", "brand", "mentioned", "position", "tone"], rows);
}

/** wrong_facts.csv: one row per incorrect claim about the client or a tracked competitor. */
export function wrongFactsCsv(analyzed: AnalyzedResponse[], config: Config): string {
  const tracked = new Set(config.brands.filter((b) => b.role !== "other").map((b) => b.key));
  const rows = analyzed.flatMap((r) =>
    r.wrongFacts.filter((f) => tracked.has(f.brand)).map((f) => [f.responseId, f.brand, f.factKey, f.claimText]),
  );
  return toCsv(["response_id", "brand", "fact_key", "claim_text"], rows);
}
