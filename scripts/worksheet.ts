/**
 * Writes docs/hand-check-worksheet.md: the random accuracy sample as a fill-in worksheet.
 * Each answer shows the text first, blanks for your own labels, then the tool's verdict
 * hidden in a collapsible block so you decide before you look.
 * Usage: npm run worksheet [count] [seed]
 */
import fs from "node:fs";
import path from "node:path";
import { getAnalysis } from "../lib";

const count = Number(process.argv[2] ?? 15);
let seed = Number(process.argv[3] ?? 2026);
// Same PRNG and draw as scripts/sample.ts, so both show the same answers.
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const { config, responses } = getAnalysis();
const pool = responses.filter((r) => !r.failed);
const picked = new Set<number>();
while (picked.size < Math.min(count, pool.length)) picked.add(Math.floor(rand() * pool.length));
const name = (k: string) => config.brands.find((b) => b.key === k)?.name ?? k;
const question = (id: string) => config.prompts.find((p) => p.id === id)?.question ?? id;

const out: string[] = [
  "# Hand-check worksheet",
  "",
  "For each answer below:",
  "",
  "1. Read the **answer text**.",
  "2. Fill in **My labels** yourself, without opening the tool's verdict.",
  "3. Click **Tool's verdict** to open it and compare.",
  "4. Tick `[x]` if you agree, or write what you think is right.",
  "",
  "**Companies:** Corvane Fleet, Trakvia, Routelyne, Gridwell, Fleetora, Novahaul. Corvane Logistics does **not** count.",
  "",
  "**Tones:** recommended (suggests choosing it) · neutral (just named) · negative (criticised but not ruled out) · not_recommended (advises against it). If an answer is mixed, use the final verdict.",
  "",
  "**True facts (from facts.json):**",
  "",
  "- **Corvane:** Columbus, Ohio, founded 2014, $29 per vehicle per month. Has ELD and fuel cards. **No** dashcams. Integrates with QuickBooks, WEX and Comdata.",
  "- **Trakvia:** Austin, Texas, founded 2016, $39. Has dashcams and ELD. No fuel cards. Integrates with Salesforce.",
  "- **Routelyne:** Phoenix, Arizona, founded 2019, $19. **No** ELD, no maintenance alerts. No integrations.",
  "- **Gridwell:** Chicago, Illinois, founded 2008, $55. Has dashcams and ELD. Integrates with SAP and Oracle.",
  "",
  "---",
  "",
];

let n = 0;
for (const i of picked) {
  const r = pool[i];
  n++;
  out.push(`## ${n}. ${r.id}`, "", `*Week ${r.week} · ${r.engine} · question ${r.promptId}: "${question(r.promptId)}"*`, "");
  out.push("**Answer text:**", "", ...r.text.split("\n").map((l) => `> ${l}`), "");
  out.push(
    "**My labels:**",
    "",
    "- Companies named, in order: ",
    "- Tone of each: ",
    "- Wrong facts: ",
    "",
    "<details><summary><b>Tool's verdict</b> (open after you've decided)</summary>",
    "",
  );
  const named = r.results.filter((x) => x.mentioned).sort((a, b) => a.position! - b.position!);
  if (!named.length) out.push("- No companies mentioned");
  for (const b of named) out.push(`- #${b.position} ${name(b.brand)}: **${b.tone}**`);
  out.push(`- Wrong facts: ${r.wrongFacts.length ? r.wrongFacts.map((f) => `${name(f.brand)} \`${f.factKey}\` ("${f.claimText}")`).join("; ") : "none"}`);
  out.push("", "</details>", "", "- [ ] I agree with the tool on this answer", "- If not, what's different: ", "", "---", "");
}
out.push("## Result", "", `Answers where I fully agree: ___ / ${n}`, "", "Disagreements (answer number and what I'd label it):", "");

const file = path.resolve("docs", "hand-check-worksheet.md");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, out.join("\n"));
console.log(`Wrote ${file}`);
