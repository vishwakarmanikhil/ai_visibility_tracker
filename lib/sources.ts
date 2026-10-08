import type { AnalyzedResponse, Config } from "./types";

export interface SourceStat {
  domain: string;
  /** "own:<brand>" when the domain is a company's own website, otherwise "third_party". */
  kind: string;
  answers: number;
  /** For each brand: how many answers citing this domain also mention the brand. */
  byBrand: Record<string, number>;
  engines: string[];
  /** Third-party site that shows up next to competitors but never next to the client. */
  gap: boolean;
}

export function domainOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function sourceStats(responses: AnalyzedResponse[], config: Config, client: string, weeks?: number[]): SourceStat[] {
  const map = new Map<string, { answers: Set<string>; byBrand: Record<string, number>; engines: Set<string> }>();
  for (const r of responses) {
    if (r.failed || (weeks && !weeks.includes(r.week))) continue;
    const domains = new Set(r.citations.map(domainOf).filter((d): d is string => !!d));
    for (const d of domains) {
      if (!map.has(d)) map.set(d, { answers: new Set(), byBrand: {}, engines: new Set() });
      const s = map.get(d)!;
      s.answers.add(r.id);
      s.engines.add(r.engine);
      for (const b of r.results) if (b.mentioned) s.byBrand[b.brand] = (s.byBrand[b.brand] ?? 0) + 1;
    }
  }
  const competitors = config.brands.filter((b) => b.key !== client).map((b) => b.key);
  return [...map.entries()]
    .map(([domain, s]) => {
      const owner = config.brands.find((b) => domain === b.website || domain.endsWith(`.${b.website}`));
      const kind = owner ? `own:${owner.key}` : "third_party";
      const competitorHits = competitors.reduce((a, c) => a + (s.byBrand[c] ?? 0), 0);
      return {
        domain,
        kind,
        answers: s.answers.size,
        byBrand: s.byBrand,
        engines: [...s.engines].sort(),
        gap: kind === "third_party" && competitorHits > 0 && !s.byBrand[client],
      };
    })
    .sort((a, b) => b.answers - a.answers);
}
