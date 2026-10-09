import DownloadLink from "../DownloadLink";
import type { ViewProps } from "./types";
import { buildModel } from "@/lib/score";
import { engineLabel } from "@/lib/insights";

export default function MethodView({ analysis, sp }: ViewProps) {
  const { config, responses, issues } = analysis;
  const model = buildModel(responses, config);
  const c = config.toneCredit;
  const count = (w: number, e: string) => responses.filter((r) => r.week === w && r.engine === e && !r.failed).length;
  const expected = model.prompts.length * 2;

  return (
    <>
      <h1>How it works</h1>

      <section className="panel">
        <h2>The visibility score</h2>
        <p>
          Every week we ask {model.prompts.length} buyer questions to {model.engines.length} AI engines, twice each. In every answer, each company earns points:
        </p>
        <ul className="clean">
          <li>
            <strong>{c.recommended}</strong> if the AI recommends it (&quot;Corvane is a strong pick&quot;)
          </li>
          <li>
            <strong>{c.neutral}</strong> if it is just named (&quot;other options include Corvane&quot;)
          </li>
          <li>
            <strong>{c.negative}</strong> if it is criticised but not ruled out (&quot;cheap, but support is slow&quot;)
          </li>
          <li>
            <strong>{c.not_recommended}</strong> if the AI advises against it, or doesn&apos;t mention it at all
          </li>
        </ul>
        <p>
          The score is the average over all questions and engines, where a priority-3 question counts three times as much as a priority-1 question. 100 would mean
          every AI recommends you in every answer. The number answers one question: <em>when our buyers ask AI, how well does it treat us?</em>
        </p>
        <h3>Real change vs noise</h3>
        <p>
          AI answers vary even when nothing changes: we ask every question twice, and the two runs often disagree. We measure how much they disagree and use that
          to work out how far the score would move by pure chance. A change is only called <strong>real</strong> when it is more than about twice that amount
          (roughly 95% confidence). Otherwise it is labelled <strong>noise</strong>. Single weeks are noisy, so we also compare the last two weeks with the two
          before, and look at each engine separately. That is usually where real movement shows up first.
        </p>
        <h3>Incomplete weeks</h3>
        <p>
          If an engine wasn&apos;t collected in a week, its last known results are carried forward in the score (and the week is flagged). Changes are always
          compared only on questions and engines collected in both periods, so a missing engine can never look like a drop.
        </p>
      </section>

      <section className="panel">
        <h2>How answers are read</h2>
        <ul className="clean">
          <li>
            <strong>Mentions</strong>: company names in any form (case, spacing, &quot;CorvaneFleet&quot;, websites like corvanefleet.com, and close misspellings
            like &quot;Corvain&quot;). Citations don&apos;t count. &quot;Corvane Logistics&quot; is a different company and never counts as Corvane.
          </li>
          <li>
            <strong>Position</strong>: the order in which companies are first named in the answer text.
          </li>
          <li>
            <strong>Tone</strong>: rules that look for phrases like &quot;I&apos;d start with&quot;, &quot;safest choice&quot; (recommended), &quot;clunky&quot;,
            &quot;complaints&quot; (negative), &quot;avoid&quot;, &quot;I&apos;d skip it&quot; (not recommended). A sentence that doesn&apos;t name a company but
            says &quot;it&quot; is read as being about the company just mentioned. When an answer is mixed, the last judgement wins.
          </li>
          <li>
            <strong>Wrong facts</strong>: claims about price, headquarters, founding year, features and integrations are checked against the fact sheet. Claims the
            fact sheet doesn&apos;t cover (ratings, support hours) are treated as unverified, not wrong.
          </li>
          <li>Everything runs locally with rules. No paid AI service is used.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Data health</h2>
        <p>
          {config.dataDir === "uploaded files" ? (
            <>
              {responses.length} answers loaded from files in this browser. To add a week, use &quot;Replace data&quot; and include the new <code>.jsonl</code>{" "}
              file with the rest of the data pack.
            </>
          ) : (
            <>
              {responses.length} answers loaded from <code>{config.dataDir.split(/[\\/]/).pop()}</code>. To add a week, drop a new <code>.jsonl</code> file
              into that folder and refresh.
            </>
          )}
        </p>
        <ul className="clean">
          {issues.map((i) => (
            <li key={i.kind}>
              {i.detail}: <strong>{i.count}</strong>
            </li>
          ))}
        </ul>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                {model.engines.map((e) => (
                  <th key={e} className="num">
                    {engineLabel(e)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.weeks.map((w) => (
                <tr key={w}>
                  <td>Week {w}</td>
                  {model.engines.map((e) => {
                    const n = count(w, e);
                    return (
                      <td key={e} className="num">
                        {n < expected ? <span className={`badge ${n === 0 ? "down" : "warn"}`}>{n}</span> : n} / {expected}
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
        <h2>Downloads</h2>
        <ul className="clean">
          <li>
            <DownloadLink name="board_report.csv">board_report.csv</DownloadLink>: weekly scores and rates per company, by engine and buying stage
          </li>
          <li>
            <DownloadLink name="mentions.csv">mentions.csv</DownloadLink>: one row per answer per company (the scoring export)
          </li>
          <li>
            <DownloadLink name="wrong_facts.csv">wrong_facts.csv</DownloadLink>: every incorrect claim
          </li>
        </ul>
      </section>
    </>
  );
}
