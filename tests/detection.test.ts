import { describe, expect, it } from "vitest";
import { analyzeResponse } from "../lib/analyze";
import { findMentions } from "../lib/mentions";
import { sentenceTone } from "../lib/tone";
import { brands, config, record } from "./helpers";

const result = (text: string, brand: string) => analyzeResponse(record(text), config).results.find((r) => r.brand === brand)!;
const mentioned = (text: string) => [...new Set(findMentions(text, brands).spans.map((s) => s.brand))];

describe("mention detection", () => {
  it("finds every spelling of a name, including websites and spacing/case variants", () => {
    expect(mentioned("Try CorvaneFleet, TrakVia, Route Lyne and GRIDWELL.")).toEqual(["corvane", "trakvia", "routelyne", "gridwell"]);
    expect(mentioned("See corvanefleet.com or https://www.novahaul.com for details.")).toEqual(["corvane", "novahaul"]);
    expect(mentioned("Gridwell Systems and Fleetora both work.")).toEqual(["gridwell", "fleetora"]);
  });

  it("catches obvious misspellings of capitalised names", () => {
    expect(mentioned("If I had to pick one, it would be Corvain Fleet.")).toEqual(["corvane"]);
    expect(mentioned("Trackvia is popular.")).toEqual(["trakvia"]);
  });

  it("never mistakes ordinary words for a company", () => {
    expect(mentioned("For a fleet of 30 to 80 vehicles, route planning matters. Track via GPS.")).toEqual([]);
  });

  it("never counts Corvane Logistics as the client", () => {
    expect(mentioned("Corvane Logistics is a freight brokerage based in Ohio.")).toEqual([]);
    expect(mentioned("Not to be confused with Corvane Logistics.")).toEqual([]);
    expect(result("Corvane Logistics offers LTL shipping. Corvane Fleet is a strong pick.", "corvane").mentioned).toBe(true);
  });

  it("numbers positions by first appearance, counting each company once", () => {
    const r = analyzeResponse(record("Fleetora is fine. Corvane is a strong pick. Fleetora again. Then Trakvia."), config);
    const pos = Object.fromEntries(r.results.filter((x) => x.mentioned).map((x) => [x.brand, x.position]));
    expect(pos).toEqual({ fleetora: 1, corvane: 2, trakvia: 3 });
  });

  it("ignores citations: only the answer text is searched", () => {
    const r = analyzeResponse(record("Trakvia is a strong pick.", { citations: ["https://corvanefleet.com/pricing"] }), config);
    expect(r.results.find((x) => x.brand === "corvane")!.mentioned).toBe(false);
  });

  it("returns blank results for failed answers", () => {
    const r = analyzeResponse(record("", { failed: true }), config);
    expect(r.results.every((x) => !x.mentioned && x.position === null && x.tone === null)).toBe(true);
  });
});

describe("tone", () => {
  it.each([
    ["For small fleets, Corvane is a strong pick.", "recommended"],
    ["Bottom line: for small fleets, I'd start with Corvane.", "recommended"],
    ["Other options include Corvane and Fleetora.", "neutral"],
    ["Routelyne is cheap, but users report slow support.", "negative"],
    ["Routelyne is often recommended, but recent reviews flag outages and slow fixes, so go in with caution.", "negative"],
    ["Avoid Gridwell if you run fewer than 100 vehicles.", "not_recommended"],
    ["For mid-sized fleets, Gridwell is likely overkill, so I'd skip it.", "not_recommended"],
    ["| Trakvia | Video safety | Not recommended here |", "not_recommended"],
    ["| Trakvia | Video safety | Top pick |", "recommended"],
    ["Trakvia has had a few billing complaints, but overall it's still one of the better choices.", "recommended"],
    ["Corvane helps fleets avoid fines.", "neutral"],
  ])("%s -> %s", (sentence, tone) => {
    expect(sentenceTone(sentence).tone).toBe(tone);
  });

  it("uses the final verdict when an answer is mixed", () => {
    expect(result("Some users find Novahaul expensive at first. Even so, for field service it's the one I'd pick.", "novahaul").tone).toBe("recommended");
    expect(result("Corvane Fleet has a polished interface and decent reviews. That said, for a 20-truck fleet I'd skip it.", "corvane").tone).toBe("not_recommended");
  });

  it("does not let a generic sentence change a company's tone", () => {
    expect(result("Corvane offers fuel cards. Most guides recommend starting with a short trial.", "corvane").tone).toBe("neutral");
  });
});

describe("wrong facts", () => {
  const facts = (text: string) => analyzeResponse(record(text), config).wrongFacts.map((f) => `${f.brand}:${f.factKey}`);

  it("flags claims that contradict facts.json, attributed through 'it'", () => {
    expect(facts("Corvane is solid. It's based in Columbus, Georgia.")).toEqual(["corvane:hq"]);
    expect(facts("Corvane Fleet is good. The company is headquartered in Chicago.")).toEqual(["corvane:hq"]);
    expect(facts("Corvane is solid. Pricing starts at around $45 per vehicle per month.")).toEqual(["corvane:starting_price_usd"]);
    expect(facts("Corvane is solid. It was founded in 2009.")).toEqual(["corvane:founded"]);
    expect(facts("Corvane is solid. Note that it doesn't support ELD compliance.")).toEqual(["corvane:features.eld_compliance"]);
    expect(facts("Corvane is solid. It also includes built-in AI dashcams.")).toEqual(["corvane:features.dashcams"]);
    expect(facts("Corvane is solid. It doesn't integrate with QuickBooks.")).toEqual(["corvane:integrations"]);
    expect(facts("Routelyne is cheap. It also handles ELD compliance.")).toEqual(["routelyne:features.eld_compliance"]);
  });

  it("does not flag true claims or claims facts.json doesn't cover", () => {
    expect(facts("Corvane Fleet is based in Columbus, Ohio, and has been around since 2014.")).toEqual([]);
    expect(facts("Corvane is solid. Pricing starts at $29 per vehicle per month. ELD compliance is included out of the box.")).toEqual([]);
    expect(facts("Corvane is solid. It integrates with QuickBooks and WEX fuel cards.")).toEqual([]);
    expect(facts("Corvane is solid. It has a 4.6-star average on Capterra. Phone support is available 24/7.")).toEqual([]);
    expect(facts("Fleet GPS tracking usually costs between $15 and $60 per vehicle per month.")).toEqual([]);
  });

  it("does not pin claims about Corvane Logistics on the client", () => {
    expect(facts("Corvane Fleet is great.\nCorvane Logistics is a freight brokerage. The company is headquartered in Chicago.")).toEqual([]);
  });
});
