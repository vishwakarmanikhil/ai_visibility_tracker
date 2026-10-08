import type { Tone } from "./types";

/**
 * Rules-based tone. Each sentence that talks about a company is classified with the first
 * rule group that matches, checked in this order:
 *   1. advises against      -> not_recommended
 *   2. "but overall/even so" -> recommended (criticism followed by a positive final verdict)
 *   3. criticism            -> negative
 *   4. suggests choosing it -> recommended
 *   otherwise               -> neutral
 * The company's overall tone in an answer is the tone of the LAST sentence that carries a
 * judgement (the brief: "use the tone of its final verdict").
 */
const NOT_RECOMMENDED = [
  // "Avoid Gridwell if ...", but not "helps fleets avoid fines"
  /(?<!\bto |\bhelps? (?:you |fleets |drivers )?)\bavoid\b/,
  /\bwouldn['’]?t (?:choose|pick|recommend|go with|use|buy)\b/,
  /\bwould not (?:choose|pick|recommend|go with)\b/,
  /\b(?:not|isn['’]?t|is not) (?:the |a )?(?:right|good|great) (?:fit|choice|option)\b/,
  /\bnot (?:a )?(?:fit|suitable)\b/,
  /\bpoor fit\b/,
  /\bskip\b/,
  /\boverkill\b/,
  /\bnot recommended\b/,
  /\bnot (?:for|meant for|built for|suited to) (?:small|smaller|your)\b/,
  /\bsteer clear\b/,
  /\bdon['’]?t (?:recommend|choose|bother)\b/,
  /\bwouldn['’]?t recommend\b/,
  /\brule (?:it|them) out\b/,
  /\blook elsewhere\b/,
];

const MIXED_THEN_POSITIVE = [
  /\b(?:even so|still|that said|overall)\b[^.]*\b(?:one i['’]?d pick|i['’]?d (?:pick|choose|recommend)|better choices?|good choice|solid choice|best|recommend(?:ed)?)\b/,
  /\bbut overall\b[^.]*\b(?:better|good|solid|strong)\b/,
];

const NEGATIVE = [
  /\bcaution\b/,
  /\bcomplain(?:t|ts|ed)?\b/,
  /\bclunky\b/,
  /\blimited\b/,
  /\bslow\b/,
  /\boutages?\b/,
  /\bexpensive\b/,
  /\bpricey\b/,
  /\btakes? longer\b/,
  /\bdrawbacks?\b/,
  /\bdownsides?\b/,
  /\bbuggy\b/,
  /\bunreliable\b/,
  /\bfrustrat\w*/,
  /\bweak(?:er|ness)?\b/,
  /\bpoor\b/,
  /\bdated\b/,
  /\bhidden fees\b/,
  /\bissues\b/,
  /\bnegative reviews?\b/,
  /\bmixed (?:reviews|feedback)\b/,
];

const RECOMMENDED = [
  /\bbest (?:overall|option|choice|pick|fit)\b/,
  /\btop (?:pick|suggestion|choice|recommendation)\b/,
  /\bsafest (?:choice|bet|option)\b/,
  /\bstrong (?:pick|choice|option)\b/,
  /\bhard to beat\b/,
  /\bi['’]?d (?:recommend|start with|pick|go with|choose|suggest)\b/,
  /\bi (?:would )?recommend\b/,
  /\bif i had to pick\b/,
  /\bit would be\b/,
  /\bstart (?:your shortlist|with)\b/,
  /\b(?:well )?worth shortlisting\b/,
  /\breliable choice\b/,
  /\bstands out\b/,
  /\bone i['’]?d pick\b/,
  /\bour (?:pick|recommendation)\b/,
  /\bgo-to\b/,
  /\bexcellent (?:choice|option)\b/,
  /\bgreat (?:choice|option|fit)\b/,
];

export interface ToneRuleHit {
  tone: Tone;
  rule: string;
}

export function sentenceTone(sentence: string): ToneRuleHit {
  const s = sentence.toLowerCase().replace(/\*\*/g, "");
  const groups: [Tone, RegExp[]][] = [
    ["not_recommended", NOT_RECOMMENDED],
    ["recommended", MIXED_THEN_POSITIVE],
    ["negative", NEGATIVE],
    ["recommended", RECOMMENDED],
  ];
  for (const [tone, rules] of groups) {
    const hit = rules.find((r) => r.test(s));
    if (hit) return { tone, rule: hit.source };
  }
  return { tone: "neutral", rule: "" };
}

/** Final verdict: the last non-neutral judgement wins; a company only ever named neutrally is neutral. */
export function finalTone(sentenceTones: Tone[]): Tone {
  for (let i = sentenceTones.length - 1; i >= 0; i--) if (sentenceTones[i] !== "neutral") return sentenceTones[i];
  return "neutral";
}
