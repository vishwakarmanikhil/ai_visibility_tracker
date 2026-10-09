import Link from "next/link";
import type { ViewProps } from "./types";
import { buildBriefing, engineLabel, factLabel } from "@/lib/insights";
import { ChangeBadge, Dot, Sparkline } from "../components";

export default function MondayView({ analysis, sp }: ViewProps) {
  const { config } = analysis;
  const client = sp.as && config.brands.some((b) => b.key === sp.as) ? sp.as : config.client;
  const b = buildBriefing(analysis, client, sp.week ? Number(sp.week) : undefined);
  const name = (k: string) => config.brands.find((x) => x.key === k)?.name ?? k;
  const tracked = config.brands.filter((x) => x.role !== "other");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "end", justifyContent: "space-between" }}>
        <div>
          <h1>Monday briefing: week {b.week}</h1>
          <p className="muted">
            How ChatGPT, Perplexity and Google AI Overviews answer {b.model.prompts.length} buyer questions, seen from {b.client.name}&apos;s side.
          </p>
        </div>
        <form className="filters" method="get">
          <label>
            Week
            <select name="week" defaultValue={String(b.week)}>
              {b.model.weeks.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            View as
            <select name="as" defaultValue={client}>
              {tracked.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Show</button>
        </form>
      </div>

      {b.partial && (
        <div className="notice">
          <strong>Incomplete week.</strong> No answers were collected from {b.partial.missingEngines.map(engineLabel).join(", ")} in week {b.week} (
          {Math.round(b.partial.coverage * 100)}% of the usual data). Scores carry those engines&apos; last known results forward, and changes compare only like with
          like, so this gap is not shown as a drop.
        </div>
      )}

      <p className="headline">{b.headline}</p>

      <section className="grid cards" aria-label="Visibility scores">
        {b.cards.map((c) => (
          <div key={c.brand.key} className={`panel card ${c.brand.key === client ? "client" : ""}`}>
            <div className="name">
              <Dot brand={c.brand.key} />
              {c.brand.name}
              {c.brand.key === client && <span className="badge">you</span>}
            </div>
            <div className="score">
              {c.score === null ? "–" : c.score.toFixed(0)} <small>/ 100</small>
            </div>
            <div className="chips">
              <ChangeBadge c={c.weekly} label="vs last week" />
              <ChangeBadge c={c.trend} label="2-week trend" />
            </div>
            <Sparkline points={c.history} brand={c.brand.key} />
            <div className="small muted">
              Named in {Math.round(c.mentionRate * 100)}% of answers · recommended in {Math.round(c.recommendRate * 100)}%
              {c.avgPosition !== null && <> · avg position {c.avgPosition.toFixed(1)}</>}
            </div>
          </div>
        ))}
      </section>
      <p className="small muted" style={{ marginTop: "-.4rem" }}>
        Score = how well AI answers treat the company, out of 100 (recommended 100, named 50, criticised 25, advised against or missing 0), weighted by question
        priority. &quot;Noise&quot; means the change is within what we see between two runs of the same question. <Link href="/method">How it works</Link>
      </p>

      <div className="grid two">
        <section className="panel">
          <h2>What changed and why</h2>
          <ul className="clean">
            {b.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Who gained or lost ground</h2>
          <ul className="clean">
            {b.whoMoved.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Suggested actions</h2>
        <ol className="actions">
          {b.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>Wrong-fact alerts</h2>
        <p className="small muted">
          Claims that contradict our fact sheet, up to week {b.week}. Claims the fact sheet doesn&apos;t cover (ratings, support hours) are not flagged.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Fact</th>
                <th>AI says</th>
                <th>Truth</th>
                <th className="num">This week</th>
                <th className="num">All weeks</th>
                <th>Engines</th>
                <th>Latest example</th>
              </tr>
            </thead>
            <tbody>
              {b.alerts.map((a) => (
                <tr key={`${a.brand}-${a.factKey}`}>
                  <td>
                    <Dot brand={a.brand} /> {name(a.brand)}
                  </td>
                  <td>{factLabel(a.factKey)}</td>
                  <td>{a.claimed.join(" / ")}</td>
                  <td>{a.expected}</td>
                  <td className="num">{a.thisWeek ? <span className="badge down">{a.thisWeek}</span> : 0}</td>
                  <td className="num">{a.total}</td>
                  <td>{a.engines.map(engineLabel).join(", ")}</td>
                  <td className="small">
                    <Link href={`/explore?id=${a.examples[0].responseId}`}>&ldquo;{a.examples[0].claimText}&rdquo;</Link>
                    <span className="muted"> (week {a.examples[0].week})</span>
                  </td>
                </tr>
              ))}
              {!b.alerts.length && (
                <tr>
                  <td colSpan={8}>No wrong facts detected.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Score by AI engine</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                {b.model.engines.map((e) => (
                  <th key={e}>{engineLabel(e)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.cards.map((c) => (
                <tr key={c.brand.key}>
                  <td>
                    <Dot brand={c.brand.key} /> {c.brand.name}
                  </td>
                  {b.model.engines.map((e) => {
                    const m = b.engineMoves.find((x) => x.brand === c.brand.key && x.engine === e)!;
                    return (
                      <td key={e}>
                        <div className="chips">
                          <ChangeBadge c={m.weekly} label="wk" />
                          <ChangeBadge c={m.trend} label="2-wk" />
                        </div>
                        <div className="small muted">
                          {m.trend.before?.toFixed(0) ?? "–"} → {m.trend.after?.toFixed(0) ?? "–"} (two-week averages)
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
