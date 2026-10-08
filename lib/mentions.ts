import type { Brand, MentionSpan } from "./types";
import { damerauLevenshtein } from "./text";

/** A span of text that names a company we must NOT count (e.g. "Corvane Logistics"). */
export interface ExcludedSpan {
  brand: string;
  start: number;
  end: number;
  text: string;
}

interface Matcher {
  brand: Brand;
  re: RegExp;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a pattern for one alias. Names tolerate case changes and an optional space or
 * hyphen between letters ("RouteLyne", "Route Lyne", "Corvane-Fleet", "CorvaneFleet");
 * websites tolerate http(s):// and www.
 */
function aliasPattern(alias: string): string {
  if (/\.[a-z]{2,}$/i.test(alias)) return `(?:https?:\\/\\/)?(?:www\\.)?${escapeRe(alias)}`;
  const letters = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
  return letters.split("").map(escapeRe).join("[\\s-]?");
}

export function buildMatchers(brands: Brand[]): Matcher[] {
  return brands.map((brand) => {
    const alts = [...new Set(brand.aliases.map(aliasPattern))].sort((a, b) => b.length - a.length);
    return { brand, re: new RegExp(`(?<![A-Za-z0-9])(?:${alts.join("|")})(?![A-Za-z0-9])`, "gi") };
  });
}

/** Single-word spellings we compare against for typo tolerance, e.g. "corvane", "trakvia". */
function fuzzyTargets(brand: Brand): string[] {
  const t = new Set<string>();
  for (const a of brand.aliases) {
    const base = a.replace(/\.[a-z]{2,}$/i, "").toLowerCase();
    const letters = base.replace(/[^a-z0-9]/g, "");
    if (letters.length >= 6) t.add(letters);
    const first = base.split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
    if (first.length >= 6) t.add(first);
  }
  return [...t];
}

function maxTypos(len: number): number {
  return len >= 7 ? 2 : 1;
}

function isFollowedBy(text: string, end: number, words: string[]): string | null {
  for (const w of words) {
    const m = text.slice(end).match(new RegExp(`^[\\s-]+(${escapeRe(w)})\\b`, "i"));
    if (m) return m[0];
  }
  return null;
}

/**
 * Find every mention of every brand in an answer's text (citations are never passed in).
 * Returns mentions plus "excluded" spans such as "Corvane Logistics", which the caller
 * uses so that sentences about the look-alike company are not credited to the client.
 */
export function findMentions(text: string, brands: Brand[], matchers = buildMatchers(brands)): { spans: MentionSpan[]; excluded: ExcludedSpan[] } {
  const raw: MentionSpan[] = [];
  const excluded: ExcludedSpan[] = [];
  for (const { brand, re } of matchers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      raw.push({ brand: brand.key, start: m.index, end: m.index + m[0].length, text: m[0], fuzzy: false });
    }
  }

  // Typo tolerance: capitalised words (or two adjacent capitalised words) close to a brand
  // spelling, e.g. "Corvain", "Trackvia", "Route Line". Lower-case words are skipped so that
  // ordinary text like "a fleet of 30" can never turn into "Fleetora".
  const covered = (s: number, e: number) => raw.some((r) => s < r.end && e > r.start);
  const words = [...text.matchAll(/[A-Za-z][A-Za-z0-9]*/g)].map((w) => ({ s: w.index!, e: w.index! + w[0].length, w: w[0] }));
  const capitalised = (w: string) => /^[A-Z]/.test(w);
  for (let i = 0; i < words.length; i++) {
    if (!capitalised(words[i].w)) continue;
    const candidates = [words[i]];
    if (i + 1 < words.length && capitalised(words[i + 1].w) && /^[\s-]$/.test(text.slice(words[i].e, words[i + 1].s)))
      candidates.push({ s: words[i].s, e: words[i + 1].e, w: words[i].w + words[i + 1].w });
    for (const c of candidates) {
      if (covered(c.s, c.e)) continue;
      const lw = c.w.toLowerCase();
      let best: { brand: string; dist: number } | null = null;
      for (const b of brands) {
        for (const t of fuzzyTargets(b)) {
          if (lw.slice(0, 3) !== t.slice(0, 3) || Math.abs(lw.length - t.length) > 2) continue;
          const dist = damerauLevenshtein(lw, t);
          if (dist > 0 && dist <= maxTypos(t.length) && (!best || dist < best.dist)) best = { brand: b.key, dist };
        }
      }
      if (best) {
        raw.push({ brand: best.brand, start: c.s, end: c.e, text: text.slice(c.s, c.e), fuzzy: true });
        break;
      }
    }
  }

  // Keep the longest match where matches overlap ("corvanefleet.com" beats "corvanefleet").
  raw.sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: MentionSpan[] = [];
  for (const r of raw) {
    const last = spans[spans.length - 1];
    if (last && r.start < last.end) continue;
    const brand = brands.find((b) => b.key === r.brand)!;
    const tail = isFollowedBy(text, r.end, brand.notThisBrandWhenFollowedBy);
    if (tail) {
      excluded.push({ brand: r.brand, start: r.start, end: r.end + tail.length, text: text.slice(r.start, r.end + tail.length) });
      continue;
    }
    spans.push(r);
  }
  return { spans, excluded };
}

/** Position = order of first appearance among brands; 1 is the first company named. */
export function positions(spans: MentionSpan[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (!order.has(s.brand)) order.set(s.brand, order.size + 1);
  }
  return order;
}
