import Link from "next/link";
import type { ViewProps } from "./types";
import { buildModel, displacements, headToHead } from "@/lib/score";
import { engineLabel, stageLabel } from "@/lib/insights";
import { Dot, WeekPicker } from "../components";

export default function HeadToHeadView({ analysis, sp }: ViewProps) {
  const { config, responses } = analysis;
  const model = buildModel(responses, config);
  const week = sp.week && model.weeks.includes(Number(sp.week)) ? Number(sp.week) : model.weeks[model.weeks.length - 1];
  const keys = config.brands.map((b) => b.key);
  const cells = headToHead(model, keys, week);
  const name = (k: string) => config.brands.find((b) => b.key === k)?.name ?? k;
  const wins = new Map<string, number>();
  for (const c of cells) if (c.winner) wins.set(c.winner, (wins.get(c.winner) ?? 0) + 1);
  const tracked = config.brands.filter((b) => b.role !== "other").map((b) => b.key);
  const disp = displacements(model, week, tracked);

  return (
    <>
      <h1>Head-to-head: week {week}</h1>
      <p className="muted">
        For each question on each engine, the company the AI treats best: recommended beats named, named beats criticised. Results are averaged over both runs.
        &quot;Tie&quot; means no clear winner. Cells marked * reuse last week&apos;s answers because that engine wasn&apos;t collected this week.
      </p>
      <WeekPicker weeks={model.weeks} week={week} />

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Questions won</h2>
        <div className="legend">
          {config.brands.map((b) => (
            <span key={b.key}>
              <Dot brand={b.key} /> {b.name}: <strong>{wins.get(b.key) ?? 0}</strong>
            </span>
          ))}
          <span>
            Tie / nobody: <strong>{cells.filter((c) => !c.winner).length}</strong>
          </span>
        </div>
        <div className="table-wrap">
          <table className="h2h">
            <thead>
              <tr>
                <th>Question</th>
                {model.engines.map((e) => (
                  <th key={e}>{engineLabel(e)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.prompts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/explore?prompt=${p.id}&week=${week}`}>
                      {p.id}: {p.question}
                    </Link>
                    <div className="small muted">
                      {stageLabel(p.stage)} · priority {p.priority}
                    </div>
                  </td>
                  {model.engines.map((e) => {
                    const c = cells.find((x) => x.promptId === p.id && x.engine === e)!;
                    const runnerUp = Object.entries(c.values).sort((a, b) => b[1] - a[1]);
                    return (
                      <td key={e} className="cell" title={runnerUp.filter(([, v]) => v > 0).map(([k, v]) => `${name(k)} ${v.toFixed(0)}`).join(", ")}>
                        {c.winner ? (
                          <>
                            <Dot brand={c.winner} /> {name(c.winner)}
                          </>
                        ) : (
                          <span className="muted">tie</span>
                        )}
                        {c.carried && " *"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Who took whose place</h2>
        <p className="small muted">
          A tracked company was named in a question/engine last week but in neither run this week. Listed alongside are the companies newly named in that slot.
        </p>
        {disp.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dropped out</th>
                  <th>Question</th>
                  <th>Engine</th>
                  <th>Newly named instead</th>
                </tr>
              </thead>
              <tbody>
                {disp
                  .sort((a, b) => tracked.indexOf(a.lost) - tracked.indexOf(b.lost))
                  .map((d, i) => (
                    <tr key={i}>
                      <td>
                        <Dot brand={d.lost} /> {name(d.lost)}
                      </td>
                      <td>{model.prompts.find((p) => p.id === d.promptId)?.question ?? d.promptId}</td>
                      <td>{engineLabel(d.engine)}</td>
                      <td>{d.takenBy.length ? d.takenBy.map(name).join(", ") : <span className="muted">nobody new</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No changes this week (or no previous week to compare).</p>
        )}
      </section>
    </>
  );
}
