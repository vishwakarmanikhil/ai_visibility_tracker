/**
 * Prints a reproducible random sample of answers with the tool's verdicts, for the manual
 * accuracy check in the README. Usage: npm run accuracy-sample [count] [seed]
 */
import { getAnalysis } from "../lib";

const count = Number(process.argv[2] ?? 15);
let seed = Number(process.argv[3] ?? 2026);
// Small deterministic PRNG (mulberry32) so the sample can be re-drawn exactly.
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const { responses } = getAnalysis();
const pool = responses.filter((r) => !r.failed);
const picked = new Set<number>();
while (picked.size < Math.min(count, pool.length)) picked.add(Math.floor(rand() * pool.length));

for (const i of picked) {
  const r = pool[i];
  console.log(`\n=== ${r.id} | week ${r.week} | ${r.engine} | ${r.promptId} run ${r.run}`);
  console.log(r.text);
  for (const b of r.results.filter((x) => x.mentioned).sort((a, b) => a.position! - b.position!))
    console.log(`  -> ${b.brand} #${b.position} ${b.tone}   [${b.toneEvidence ?? "named only"}]`);
  for (const f of r.wrongFacts) console.log(`  !! ${f.brand} ${f.factKey}: ${f.claimText}`);
}
