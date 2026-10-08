import type { AnalyzedResponse, BrandResult, Config, ResponseRecord, Tone, WrongFact } from "./types";
import { buildMatchers, findMentions, positions } from "./mentions";
import { cleanSentence, segment } from "./text";
import { finalTone, sentenceTone } from "./tone";
import { checkSentence } from "./facts";

const EXCLUDED = "__excluded__";

/** A sentence with no company name only continues the previous company if it points back to it. */
const POINTS_BACK = /\b(?:it|it['’]s|its|they|their|them|the company|the platform|the tool|this (?:tool|platform|provider|one))\b/i;

export function analyzeResponse(r: ResponseRecord, config: Config, matchers = buildMatchers(config.brands)): AnalyzedResponse {
  if (r.failed) {
    return {
      ...r,
      spans: [],
      wrongFacts: [],
      results: config.brands.map((b) => ({ brand: b.key, mentioned: false, position: null, tone: null, toneEvidence: null })),
    };
  }
  const text = r.text;
  const { spans, excluded } = findMentions(text, config.brands, matchers);
  const order = positions(spans);
  const tones = new Map<string, { tone: Tone; sentence: string }[]>();
  const wrongFacts: WrongFact[] = [];
  const seenFacts = new Set<string>();

  let lastBlock = -1;
  let lastEntity: string | null = null;
  for (const seg of segment(text)) {
    if (seg.block !== lastBlock) {
      lastBlock = seg.block;
      lastEntity = null;
    }
    const raw = text.slice(seg.start, seg.end);
    const sentence = cleanSentence(raw);
    const inSeg = spans.filter((s) => s.start >= seg.start && s.start < seg.end);
    const exInSeg = excluded.filter((s) => s.start >= seg.start && s.start < seg.end);
    const named = [...new Set(inSeg.map((s) => s.brand))];

    let toneSubjects: string[] = named;
    let factSubject: string | null = named.length === 1 ? named[0] : null;
    if (!named.length) {
      const inherited = exInSeg.length ? null : lastEntity && lastEntity !== EXCLUDED ? lastEntity : null;
      toneSubjects = inherited && POINTS_BACK.test(sentence) ? [inherited] : [];
      factSubject = inherited;
    }

    if (toneSubjects.length) {
      const { tone } = sentenceTone(sentence);
      for (const b of toneSubjects) {
        if (!tones.has(b)) tones.set(b, []);
        tones.get(b)!.push({ tone, sentence });
      }
    }

    const facts = factSubject ? config.facts[factSubject] : undefined;
    if (factSubject && facts) {
      for (const v of checkSentence(sentence, facts, config.knownIntegrations)) {
        const key = `${factSubject}|${v.factKey}|${sentence}`;
        if (seenFacts.has(key)) continue;
        seenFacts.add(key);
        wrongFacts.push({ responseId: r.id, brand: factSubject, factKey: v.factKey, claimText: sentence, claimed: v.claimed, expected: v.expected });
      }
    }

    // Who does the next "it" refer to? The last company (or look-alike) named in this sentence.
    const lastNamed = [...inSeg, ...exInSeg.map((e) => ({ ...e, brand: EXCLUDED }))].sort((a, b) => a.start - b.start).pop();
    if (lastNamed) lastEntity = lastNamed.brand;
  }

  const results: BrandResult[] = config.brands.map((b) => {
    const pos = order.get(b.key) ?? null;
    if (pos === null) return { brand: b.key, mentioned: false, position: null, tone: null, toneEvidence: null };
    const list = tones.get(b.key) ?? [];
    const tone = finalTone(list.map((t) => t.tone));
    const evidence = [...list].reverse().find((t) => t.tone === tone)?.sentence ?? null;
    return { brand: b.key, mentioned: true, position: pos, tone, toneEvidence: evidence };
  });

  return { ...r, spans, results, wrongFacts };
}

export function analyzeAll(responses: ResponseRecord[], config: Config): AnalyzedResponse[] {
  const matchers = buildMatchers(config.brands);
  return responses.map((r) => analyzeResponse(r, config, matchers));
}
