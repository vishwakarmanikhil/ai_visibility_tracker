import { getAnalysis } from "@/lib";
import { sourceStats } from "@/lib/sources";
import { engineLabel } from "@/lib/insights";
import { Dot } from "../components";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { config, responses } = getAnalysis();
  const client = sp.as && config.brands.some((b) => b.key === sp.as) ? sp.as : config.client;
  const stats = sourceStats(responses, config, client);
  const clientName = config.brands.find((b) => b.key === client)?.name ?? client;
  const gaps = stats.filter((s) => s.gap);
  const name = (k: string) => config.brands.find((b) => b.key === k)?.name ?? k;
  const owner = (kind: string) => (kind.startsWith("own:") ? kind.slice(4) : null);

  return (
    <>
      <h1>Sources the AI cites</h1>
      <p className="muted">
        Websites listed as citations, across all weeks. For each site: how many answers cited it, and which companies those answers named. Note that Google AI
        Overviews often lists no citations.
      </p>

      <section className="panel">
        <h2>Gaps: third-party sites cited next to competitors, never next to {clientName}</h2>
        {gaps.length ? (
          <ul className="clean">
            {gaps.map((g) => (
              <li key={g.domain}>
                <strong>{g.domain}</strong>: cited in {g.answers} answers naming{" "}
                {Object.entries(g.byBrand)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => `${name(k)} (${n})`)
                  .join(", ")}
                . <span className="muted">Getting listed or reviewed here is a direct route into these answers.</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>None: every third-party source also appears next to {clientName}.</p>
        )}
      </section>

      <section className="panel">
        <h2>All cited sites</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Type</th>
                <th className="num">Answers citing it</th>
                {config.brands.map((b) => (
                  <th key={b.key} className="num">
                    <Dot brand={b.key} /> {b.name.split(" ")[0]}
                  </th>
                ))}
                <th>Engines</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.domain}>
                  <td>
                    {s.domain} {s.gap && <span className="badge down">gap</span>}
                  </td>
                  <td>{owner(s.kind) ? `${name(owner(s.kind)!)}'s own site` : "third-party"}</td>
                  <td className="num">{s.answers}</td>
                  {config.brands.map((b) => (
                    <td key={b.key} className="num">
                      {s.byBrand[b.key] ?? 0}
                    </td>
                  ))}
                  <td className="small">{s.engines.map(engineLabel).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
