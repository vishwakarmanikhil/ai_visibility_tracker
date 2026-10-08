import type { Comparison } from "@/lib/score";

export const brandColor = (key: string) => `var(--c-${key}, var(--muted))`;

export function Dot({ brand }: { brand: string }) {
  return <span className="dot" style={{ background: brandColor(brand) }} />;
}

export function ChangeBadge({ c, label }: { c: Comparison; label?: string }) {
  if (c.change === null) return <span className="badge">{label ? `${label}: ` : ""}n/a</span>;
  const v = `${c.change > 0 ? "+" : c.change < 0 ? "−" : "±"}${Math.abs(c.change).toFixed(1)}`;
  const cls = c.verdict === "up" ? "up" : c.verdict === "down" ? "down" : "";
  const title =
    c.verdict === "steady"
      ? `Within normal run-to-run variation (±${(2 * (c.se ?? 0)).toFixed(1)})`
      : `Real ${c.verdict === "up" ? "rise" : "drop"}: bigger than the ±${(2 * (c.se ?? 0)).toFixed(1)} normal variation`;
  return (
    <span className={`badge ${cls}`} title={title}>
      {label ? `${label}: ` : ""}
      {v}
      {c.verdict === "steady" ? " (noise)" : c.verdict === "up" ? " real ▲" : " real ▼"}
    </span>
  );
}

/** Small trend line; partial weeks are drawn hollow. */
export function Sparkline({ points, brand }: { points: { week: number; score: number | null; partial: boolean }[]; brand: string }) {
  const w = 200;
  const h = 44;
  const valid = points.filter((p) => p.score !== null);
  if (valid.length < 2) return null;
  const x = (i: number) => 6 + (i * (w - 12)) / (points.length - 1);
  const y = (v: number) => h - 6 - (v / 100) * (h - 12);
  const d = points.map((p, i) => (p.score === null ? "" : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Score by week: ${points.map((p) => `week ${p.week} ${p.score?.toFixed(0)}`).join(", ")}`}>
      <line x1={0} x2={w} y1={y(50)} y2={y(50)} stroke="var(--line)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke={brandColor(brand)} strokeWidth={2} />
      {points.map((p, i) =>
        p.score === null ? null : (
          <circle key={p.week} cx={x(i)} cy={y(p.score)} r={3} fill={p.partial ? "var(--panel)" : brandColor(brand)} stroke={brandColor(brand)} strokeWidth={1.5}>
            <title>{`Week ${p.week}: ${p.score.toFixed(1)}${p.partial ? " (partial week)" : ""}`}</title>
          </circle>
        ),
      )}
    </svg>
  );
}

export function WeekPicker({ weeks, week, extra = {} }: { weeks: number[]; week: number; extra?: Record<string, string> }) {
  return (
    <form className="filters" method="get">
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label>
        Week
        <select name="week" defaultValue={String(week)}>
          {weeks.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Show</button>
    </form>
  );
}
