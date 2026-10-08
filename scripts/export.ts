/**
 * Writes the scoring export (mentions.csv, wrong_facts.csv) to ./output.
 * Usage: npm run export            (uses config/tracker.json)
 *        DATA_DIR=path npm run export
 */
import fs from "node:fs";
import path from "node:path";
import { getAnalysis } from "../lib";
import { mentionsCsv, wrongFactsCsv } from "../lib/exports";

const { config, responses, issues } = getAnalysis();
const outDir = path.resolve(process.argv[2] ?? "output");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "mentions.csv"), mentionsCsv(responses));
fs.writeFileSync(path.join(outDir, "wrong_facts.csv"), wrongFactsCsv(responses, config));

const wrong = responses.flatMap((r) => r.wrongFacts).filter((f) => config.brands.find((b) => b.key === f.brand)?.role !== "other");
console.log(`Read ${responses.length} answers from ${config.dataDir}`);
for (const i of issues) console.log(`  data note: ${i.detail}: ${i.count}`);
console.log(`Wrote ${path.join(outDir, "mentions.csv")} (${responses.length * config.brands.length} rows)`);
console.log(`Wrote ${path.join(outDir, "wrong_facts.csv")} (${wrong.length} rows)`);
