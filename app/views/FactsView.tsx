import DownloadLink from "../DownloadLink";
import Link from "next/link";
import type { ViewProps } from "./types";
import { engineLabel, factLabel } from "@/lib/insights";
import { Dot } from "../components";

export default function FactsView({ analysis, sp }: ViewProps) {
  const { config, responses } = analysis;
  const tracked = config.brands.filter((b) => b.role !== "other");
  const brand = sp.brand && tracked.some((b) => b.key === sp.brand) ? sp.brand : "all";
  const rows = responses
    .flatMap((r) => r.wrongFacts.map((f) => ({ ...f, week: r.week, engine: r.engine, promptId: r.promptId })))
    .filter((f) => brand === "all" || f.brand === brand)
    .sort((a, b) => b.week - a.week || a.brand.localeCompare(b.brand));
  const name = (k: string) => config.brands.find((b) => b.key === k)?.name ?? k;

  return (
    <>
      <h1>Wrong facts</h1>
      <p className="muted">
        Every claim an AI engine made that contradicts the fact sheet (facts.json), for {config.brands.find((b) => b.key === config.client)?.name} and the
        tracked competitors. Use our own errors to fix our public information; use competitors&apos; errors as sales talking points.
      </p>
      <form className="filters" method="get">
        <label>
          Company
          <select name="brand" defaultValue={brand}>
            <option value="all">All tracked companies</option>
            {tracked.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Show</button>
        <DownloadLink className="button" name="wrong_facts.csv">
          Download wrong_facts.csv
        </DownloadLink>
      </form>
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>{rows.length} wrong claims</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Company</th>
                <th>Fact</th>
                <th>What the AI said</th>
                <th>Truth</th>
                <th>Engine</th>
                <th>Answer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr key={i}>
                  <td>{f.week}</td>
                  <td>
                    <Dot brand={f.brand} /> {name(f.brand)}
                  </td>
                  <td>{factLabel(f.factKey)}</td>
                  <td>&ldquo;{f.claimText}&rdquo;</td>
                  <td>{f.expected}</td>
                  <td>{engineLabel(f.engine)}</td>
                  <td>
                    <Link href={`/explore?id=${f.responseId}`}>{f.responseId}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
