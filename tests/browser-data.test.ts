import fs from "node:fs";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { dataDirFor, getAnalysis, serverHasData } from "../lib";
import { missingFiles } from "../lib/dataset";
import { mentionsCsv, wrongFactsCsv } from "../lib/exports";
import { browserAnalysis, readPickedFiles } from "../app/browserData";

const dataDir = dataDirFor();
const hasData = serverHasData();

describe("loading the data pack in the browser", () => {
  it("reports which required files are missing", () => {
    expect(missingFiles([{ name: "brands.json" }])).toEqual(["prompts.csv", "responses (.jsonl)"]);
    expect(missingFiles([{ name: "pack/brands.json" }, { name: "pack/prompts.csv" }, { name: "pack/week7.jsonl" }])).toEqual([]);
  });

  it.skipIf(!hasData)("gives exactly the same results from the ZIP as from the data folder", async () => {
    const entries: Record<string, Uint8Array> = { "__MACOSX/._brands.json": strToU8("junk") };
    for (const f of fs.readdirSync(dataDir)) entries[`corvane_data_pack/${f}`] = new Uint8Array(fs.readFileSync(path.join(dataDir, f)));
    const zip = new File([zipSync(entries)], "corvane_data_pack.zip");

    const files = await readPickedFiles([zip]);
    expect(files.some((f) => f.name.includes("__MACOSX"))).toBe(false);
    expect(files.some((f) => f.name.endsWith("README.txt"))).toBe(false);

    const fromBrowser = browserAnalysis(files);
    const fromServer = getAnalysis();
    expect(mentionsCsv(fromBrowser.responses)).toBe(mentionsCsv(fromServer.responses));
    expect(wrongFactsCsv(fromBrowser.responses, fromBrowser.config)).toBe(wrongFactsCsv(fromServer.responses, fromServer.config));
  });
});
