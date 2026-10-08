import type { BrandFacts } from "./types";

/**
 * Fact checking against facts.json. A sentence (already attributed to one company) is
 * scanned for claims about price, HQ, founding year, features and integrations.
 * Only claims that CONTRADICT facts.json are returned; anything facts.json doesn't cover
 * (ratings, support hours, ...) is unverified and ignored.
 */

export interface FactViolation {
  factKey: string;
  claimed: string;
  expected: string;
}

/** Words that identify each feature in facts.json. Unknown feature keys fall back to their own name. */
const FEATURE_TERMS: Record<string, string> = {
  gps_tracking: String.raw`gps(?: tracking)?`,
  eld_compliance: String.raw`eld(?:s| compliance)?|electronic logging|hours[- ]of[- ]service`,
  fuel_card_integration: String.raw`fuel[- ]cards?(?: integrations?)?`,
  maintenance_alerts: String.raw`maintenance (?:alerts|reminders|scheduling)`,
  driver_app: String.raw`driver (?:mobile )?app`,
  dashcams: String.raw`(?:ai )?dash ?cams?|dashboard cameras|video[- ](?:based )?safety|in-cab (?:video|cameras)`,
  payroll: String.raw`payroll`,
};

const NEGATION = String.raw`(?:doesn['’]?t|does not|don['’]?t|do not|can['’]?t|cannot|lacks?|lacking|without|no|not|never)`;
const HAS_VERB = String.raw`(?:includes?|including|offers?|supports?|handles?|has|have|comes with|provides?|built[- ]in|features?|adds?|known for|focuses on)`;

const US_STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia",
  "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming",
];

function featureClaim(sentence: string, term: string): "has" | "lacks" | null {
  const s = sentence.toLowerCase();
  if (!new RegExp(`\\b(?:${term})\\b`).test(s)) return null;
  // "doesn't support ELD", "no dashcams", "ELD compliance isn't included"
  if (new RegExp(`\\b${NEGATION}\\b[^.;]{0,40}?\\b(?:${term})\\b`).test(s)) return "lacks";
  if (new RegExp(`\\b(?:${term})\\b[^.;]{0,25}?\\b(?:isn['’]?t|is not|aren['’]?t|are not|not)\\b[^.;]{0,15}(?:included|supported|available|offered)`).test(s)) return "lacks";
  // Sentences about what the BUYER needs are not claims about the product.
  if (/\b(?:need|needs|require|requires|looking for|want)\b/.test(s) && !new RegExp(`\\b${HAS_VERB}\\b`).test(s)) return null;
  if (new RegExp(`\\b${HAS_VERB}\\b[^.;]{0,45}?\\b(?:${term})\\b`).test(s)) return "has";
  if (new RegExp(`\\b(?:${term})\\b[^.;]{0,25}?\\b(?:is|are)\\b[^.;]{0,10}(?:included|supported|available|built in|standard)`).test(s)) return "has";
  return null;
}

function checkPrice(sentence: string, facts: BrandFacts): FactViolation | null {
  if (facts.starting_price_usd === undefined) return null;
  const amounts = [...sentence.matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]));
  // Ranges ("between $15 and $60") describe the market, not one company's price.
  if (amounts.length !== 1 || /\bbetween\b|\b(?:to|-|–)\s?\$/.test(sentence)) return null;
  if (!/\b(?:start|starts|starting|from|pricing|priced|price|costs?|pay|plans?|per (?:vehicle|truck|month|unit))\b/i.test(sentence)) return null;
  if (amounts[0] !== facts.starting_price_usd)
    return { factKey: "starting_price_usd", claimed: `$${amounts[0]}`, expected: `$${facts.starting_price_usd} ${facts.price_unit ?? ""}`.trim() };
  return null;
}

function checkFounded(sentence: string, facts: BrandFacts): FactViolation | null {
  if (facts.founded === undefined) return null;
  const m = sentence.match(/\b(?:founded|established|launched|started|around since|in business since|operating since|since)\b[^.;]{0,20}?\b((?:18|19|20)\d{2})\b/i);
  if (m && Number(m[1]) !== facts.founded) return { factKey: "founded", claimed: m[1], expected: String(facts.founded) };
  return null;
}

function splitPlace(place: string): { city: string | null; state: string | null } {
  const parts = place.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts[1] };
  if (parts.length === 1) return US_STATES.includes(parts[0]) ? { city: null, state: parts[0] } : { city: parts[0], state: null };
  return { city: null, state: null };
}

function checkHq(sentence: string, facts: BrandFacts): FactViolation | null {
  if (!facts.hq) return null;
  // Case-sensitive on purpose: the place is the run of Capitalised words after the keyword.
  const m = sentence.match(/\b(?:[Bb]ased (?:out of|in)|[Hh]eadquartered in|[Hh]eadquarters (?:is |are )?in|HQ (?:is )?in|[Ll]ocated in)\s+((?:[A-Z][\w.'-]*)(?:\s[A-Z][\w.'-]*)*(?:,\s?[A-Z][\w.'-]*(?:\s[A-Z][\w.'-]*)*)?)/);
  if (!m) return null;
  const place = m[1].replace(/[.,]+$/, "");
  const claimed = splitPlace(place);
  const truth = splitPlace(facts.hq);
  const wrongCity = claimed.city && truth.city && claimed.city !== truth.city;
  const wrongState = claimed.state && truth.state && claimed.state !== truth.state;
  if (wrongCity || wrongState) return { factKey: "hq", claimed: place, expected: facts.hq };
  return null;
}

function checkFeatures(sentence: string, facts: BrandFacts): FactViolation[] {
  const out: FactViolation[] = [];
  for (const [feature, truth] of Object.entries(facts.features ?? {})) {
    const term = FEATURE_TERMS[feature] ?? feature.replace(/_/g, "[ -]?");
    const claim = featureClaim(sentence, term);
    if ((claim === "has" && truth === false) || (claim === "lacks" && truth === true))
      out.push({ factKey: `features.${feature}`, claimed: claim === "has" ? "offers it" : "does not offer it", expected: truth ? "offers it" : "does not offer it" });
  }
  return out;
}

function checkIntegrations(sentence: string, facts: BrandFacts, known: string[]): FactViolation[] {
  if (!facts.integrations || !/\b(?:integrat\w*|connects? (?:to|with)|syncs? with|works with|plugs? into)\b/i.test(sentence)) return [];
  const named = known.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence));
  if (!named.length) return [];
  const has = new Set(facts.integrations.map((i) => i.toLowerCase()));
  const negated = new RegExp(`\\b${NEGATION}\\b[^.;]{0,25}?\\b(?:integrat|connect|sync|work)`, "i").test(sentence);
  const out: FactViolation[] = [];
  for (const n of named) {
    const truth = has.has(n.toLowerCase());
    if (negated && truth) out.push({ factKey: "integrations", claimed: `no ${n} integration`, expected: facts.integrations.join(", ") });
    if (!negated && !truth) out.push({ factKey: "integrations", claimed: `integrates with ${n}`, expected: facts.integrations.join(", ") || "none" });
  }
  return out;
}

export function checkSentence(sentence: string, facts: BrandFacts, knownIntegrations: string[]): FactViolation[] {
  return [
    checkPrice(sentence, facts),
    checkFounded(sentence, facts),
    checkHq(sentence, facts),
    ...checkFeatures(sentence, facts),
    ...checkIntegrations(sentence, facts, knownIntegrations),
  ].filter((v): v is FactViolation => v !== null);
}
