import { getAnalysis } from "@/lib";
import { ENGINE_LABELS, STAGE_LABELS } from "@/lib/insights";
import Explorer, { type ExplorerData } from "./Explorer";

export const dynamic = "force-dynamic";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { config, responses } = getAnalysis();
  const data: ExplorerData = {
    client: config.client,
    brands: config.brands.map((b) => ({ key: b.key, name: b.name, tracked: b.role !== "other" })),
    prompts: config.prompts,
    engineLabels: ENGINE_LABELS,
    stageLabels: STAGE_LABELS,
    answers: responses.map((r) => ({
      id: r.id,
      week: r.week,
      engine: r.engine,
      promptId: r.promptId,
      run: r.run,
      collectedAt: r.collectedAt,
      text: r.text,
      citations: r.citations,
      failed: r.failed,
      spans: r.spans.map((s) => ({ brand: s.brand, start: s.start, end: s.end })),
      results: r.results.map((x) => ({ brand: x.brand, mentioned: x.mentioned, position: x.position, tone: x.tone, evidence: x.toneEvidence })),
      wrongFacts: r.wrongFacts.map((f) => ({ brand: f.brand, factKey: f.factKey, claimText: f.claimText, expected: f.expected })),
    })),
  };
  return (
    <>
      <h1>Answers</h1>
      <p className="muted">
        Every AI answer, with every company mention highlighted. Filter by question, engine, buying stage and company, then click an answer to read it.
      </p>
      <Explorer data={data} initialId={sp.id} initialBrand={sp.brand} initialPrompt={sp.prompt} initialEngine={sp.engine} initialWeek={sp.week} />
    </>
  );
}
