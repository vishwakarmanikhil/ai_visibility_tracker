"use client";

import { useMemo, useState } from "react";
import type { Prompt, Tone } from "@/lib/types";

export interface ExplorerAnswer {
  id: string;
  week: number;
  engine: string;
  promptId: string;
  run: number;
  collectedAt: string | null;
  text: string;
  citations: string[];
  failed: boolean;
  spans: { brand: string; start: number; end: number }[];
  results: { brand: string; mentioned: boolean; position: number | null; tone: Tone | null; evidence: string | null }[];
  wrongFacts: { brand: string; factKey: string; claimText: string; expected: string }[];
}

export interface ExplorerData {
  client: string;
  brands: { key: string; name: string; tracked: boolean }[];
  prompts: Prompt[];
  engineLabels: Record<string, string>;
  stageLabels: Record<string, string>;
  answers: ExplorerAnswer[];
}

const TONE_LABEL: Record<Tone, string> = {
  recommended: "recommended",
  neutral: "neutral",
  negative: "negative",
  not_recommended: "not recommended",
};

const color = (b: string) => `var(--c-${b}, var(--muted))`;

function Highlighted({ a }: { a: ExplorerAnswer }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const s of [...a.spans].sort((x, y) => x.start - y.start)) {
    if (s.start > pos) parts.push(a.text.slice(pos, s.start));
    parts.push(
      <mark key={s.start} style={{ background: `color-mix(in srgb, ${color(s.brand)} 28%, transparent)`, boxShadow: `inset 0 -2px 0 ${color(s.brand)}` }} title={s.brand}>
        {a.text.slice(s.start, s.end)}
      </mark>,
    );
    pos = s.end;
  }
  parts.push(a.text.slice(pos));
  return <div className="answer-text">{parts}</div>;
}

export default function Explorer({
  data,
  initialId,
  initialBrand,
  initialPrompt,
  initialEngine,
  initialWeek,
}: {
  data: ExplorerData;
  initialId?: string;
  initialBrand?: string;
  initialPrompt?: string;
  initialEngine?: string;
  initialWeek?: string;
}) {
  const initial = data.answers.find((a) => a.id === initialId);
  const [week, setWeek] = useState(initialWeek ?? (initial ? String(initial.week) : "all"));
  const [engine, setEngine] = useState(initialEngine ?? "all");
  const [stage, setStage] = useState("all");
  const [prompt, setPrompt] = useState(initialPrompt ?? (initial ? initial.promptId : "all"));
  const [brand, setBrand] = useState(initialBrand ?? data.client);
  const [status, setStatus] = useState("any");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initialId ?? null);

  const promptById = useMemo(() => new Map(data.prompts.map((p) => [p.id, p])), [data.prompts]);
  const weeks = useMemo(() => [...new Set(data.answers.map((a) => a.week))].sort((a, b) => a - b), [data.answers]);
  const engines = useMemo(() => [...new Set(data.answers.map((a) => a.engine))].sort(), [data.answers]);
  const stages = useMemo(() => [...new Set(data.prompts.map((p) => p.stage))], [data.prompts]);
  const brandName = (k: string) => data.brands.find((b) => b.key === k)?.name ?? k;
  const engineName = (e: string) => data.engineLabels[e] ?? e;

  // Everything except the "status" and "question" filters: used for the per-question summary.
  const base = useMemo(
    () =>
      data.answers.filter(
        (a) =>
          (week === "all" || a.week === Number(week)) &&
          (engine === "all" || a.engine === engine) &&
          (stage === "all" || promptById.get(a.promptId)?.stage === stage) &&
          (!query || a.text.toLowerCase().includes(query.toLowerCase())),
      ),
    [data.answers, week, engine, stage, query, promptById],
  );

  const filtered = useMemo(
    () =>
      base.filter((a) => {
        if (prompt !== "all" && a.promptId !== prompt) return false;
        const r = a.results.find((x) => x.brand === brand);
        if (status === "mentioned") return !!r?.mentioned;
        if (status === "missing") return !a.failed && !r?.mentioned;
        if (status === "wrong_facts") return a.wrongFacts.some((f) => f.brand === brand);
        if (status !== "any") return r?.tone === status;
        return true;
      }),
    [base, prompt, brand, status],
  );

  const perQuestion = useMemo(
    () =>
      data.prompts.map((p) => {
        const rows = base.filter((a) => a.promptId === p.id && !a.failed);
        const rs = rows.map((a) => a.results.find((x) => x.brand === brand)!);
        return {
          p,
          n: rows.length,
          mentioned: rs.filter((r) => r?.mentioned).length,
          recommended: rs.filter((r) => r?.tone === "recommended").length,
          against: rs.filter((r) => r?.tone === "not_recommended" || r?.tone === "negative").length,
        };
      }),
    [base, brand, data.prompts],
  );

  const current = data.answers.find((a) => a.id === selected) ?? null;
  const reset = () => {
    setWeek("all");
    setEngine("all");
    setStage("all");
    setPrompt("all");
    setStatus("any");
    setQuery("");
  };

  return (
    <>
      <div className="panel">
        <div className="filters">
          <label>
            Company
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {data.brands.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Show answers where it is
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="any">anything</option>
              <option value="mentioned">mentioned</option>
              <option value="missing">not mentioned</option>
              <option value="recommended">recommended</option>
              <option value="neutral">neutral</option>
              <option value="negative">negative</option>
              <option value="not_recommended">not recommended</option>
              <option value="wrong_facts">described wrongly</option>
            </select>
          </label>
          <label>
            Week
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="all">All weeks</option>
              {weeks.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Engine
            <select value={engine} onChange={(e) => setEngine(e.target.value)}>
              <option value="all">All engines</option>
              {engines.map((e) => (
                <option key={e} value={e}>
                  {engineName(e)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buying stage
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">All stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {data.stageLabels[s] ?? s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question
            <select value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ maxWidth: 280 }}>
              <option value="all">All questions</option>
              {data.prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}: {p.question}
                </option>
              ))}
            </select>
          </label>
          <label>
            Text contains
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. dashcams" />
          </label>
          <button type="button" onClick={reset}>
            Clear filters
          </button>
        </div>
      </div>

      <details className="panel" open>
        <summary>
          <strong>Which questions {brandName(brand)} shows up for</strong> <span className="muted small">(current week/engine/stage filters)</span>
        </summary>
        <div className="table-wrap" style={{ marginTop: ".6rem" }}>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Stage</th>
                <th className="num">Priority</th>
                <th className="num">Answers</th>
                <th className="num">Mentioned</th>
                <th className="num">Recommended</th>
                <th className="num">Criticised / advised against</th>
              </tr>
            </thead>
            <tbody>
              {perQuestion.map((q) => (
                <tr key={q.p.id} className="list-row" onClick={() => setPrompt(q.p.id)}>
                  <td>
                    {q.p.id}: {q.p.question}
                  </td>
                  <td>{data.stageLabels[q.p.stage] ?? q.p.stage}</td>
                  <td className="num">{q.p.priority}</td>
                  <td className="num">{q.n}</td>
                  <td className="num">
                    {q.n ? (
                      <span className={`badge ${q.mentioned / q.n < 0.25 ? "down" : q.mentioned / q.n >= 0.6 ? "up" : ""}`}>{Math.round((100 * q.mentioned) / q.n)}%</span>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="num">{q.n ? `${Math.round((100 * q.recommended) / q.n)}%` : "–"}</td>
                  <td className="num">{q.n ? `${Math.round((100 * q.against) / q.n)}%` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid two" style={{ alignItems: "start" }}>
        <section className="panel" style={{ maxHeight: "80vh", overflowY: "auto" }}>
          <h2>
            {filtered.length} answer{filtered.length === 1 ? "" : "s"}
          </h2>
          {filtered.map((a) => {
            const r = a.results.find((x) => x.brand === brand);
            return (
              <div key={a.id} className={`list-row ${a.id === selected ? "active" : ""}`} onClick={() => setSelected(a.id)}>
                <div className="small muted">
                  Week {a.week} · {engineName(a.engine)} · run {a.run} · {a.promptId}
                </div>
                <div>{promptById.get(a.promptId)?.question ?? a.promptId}</div>
                <div className="chips">
                  {a.failed ? (
                    <span className="badge warn">no answer (collection failed)</span>
                  ) : r?.mentioned ? (
                    <span className={`badge ${r.tone}`}>
                      {brandName(brand)} #{r.position} · {TONE_LABEL[r.tone!]}
                    </span>
                  ) : (
                    <span className="badge">{brandName(brand)} not mentioned</span>
                  )}
                  {a.wrongFacts.length > 0 && <span className="badge down">{a.wrongFacts.length} wrong fact{a.wrongFacts.length > 1 ? "s" : ""}</span>}
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel">
          {!current ? (
            <p className="muted">Select an answer to read it.</p>
          ) : (
            <>
              <h2>{promptById.get(current.promptId)?.question ?? current.promptId}</h2>
              <p className="small muted">
                {current.id} · week {current.week} · {engineName(current.engine)} · run {current.run}
                {current.collectedAt && ` · collected ${current.collectedAt.slice(0, 10)}`}
              </p>
              {current.failed ? <p className="notice">This answer failed to collect (timeout or empty), so it is excluded from scores.</p> : <Highlighted a={current} />}

              <h3 style={{ marginTop: "1rem" }}>Companies in this answer</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th className="num">Position</th>
                      <th>Tone</th>
                      <th>Deciding sentence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.results
                      .filter((r) => r.mentioned)
                      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                      .map((r) => (
                        <tr key={r.brand}>
                          <td>
                            <span className="dot" style={{ background: color(r.brand) }} /> {brandName(r.brand)}
                          </td>
                          <td className="num">{r.position}</td>
                          <td>
                            <span className={`badge ${r.tone}`}>{TONE_LABEL[r.tone!]}</span>
                          </td>
                          <td className="small">{r.evidence ?? <span className="muted">named only</span>}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Not mentioned:{" "}
                {current.results
                  .filter((r) => !r.mentioned)
                  .map((r) => brandName(r.brand))
                  .join(", ") || "none"}
              </p>

              {current.wrongFacts.length > 0 && (
                <>
                  <h3>Wrong facts</h3>
                  <ul className="clean">
                    {current.wrongFacts.map((f, i) => (
                      <li key={i}>
                        <strong>{brandName(f.brand)}</strong>: &ldquo;{f.claimText}&rdquo; <span className="muted">(truth: {f.expected})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3>Citations</h3>
              {current.citations.length ? (
                <ul className="clean small">
                  {current.citations.map((c, i) => (
                    <li key={i} style={{ wordBreak: "break-all" }}>
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">None listed.</p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
