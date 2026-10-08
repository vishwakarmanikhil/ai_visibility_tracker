import { buildBrands } from "../lib/config";
import type { Config, ResponseRecord } from "../lib/types";

export const brands = buildBrands(
  {
    client: { name: "Corvane Fleet", website: "corvanefleet.com" },
    tracked_competitors: [
      { name: "Trakvia", website: "trakvia.com" },
      { name: "Routelyne", website: "routelyne.com" },
      { name: "Gridwell Systems", website: "gridwell.io" },
    ],
    other_companies: [
      { name: "Fleetora", website: "fleetora.com" },
      { name: "Novahaul", website: "novahaul.com" },
    ],
  },
  { corvane: { extraAliases: ["Corvane"], notThisBrandWhenFollowedBy: ["Logistics"] } },
);

export const config: Config = {
  dataDir: "",
  client: "corvane",
  brands,
  prompts: [{ id: "P01", question: "q", stage: "comparing_options", priority: 3 }],
  facts: {
    corvane: {
      starting_price_usd: 29,
      price_unit: "per vehicle per month",
      hq: "Columbus, Ohio",
      founded: 2014,
      features: { gps_tracking: true, eld_compliance: true, dashcams: false, payroll: false },
      integrations: ["QuickBooks", "WEX", "Comdata"],
    },
    routelyne: { starting_price_usd: 19, hq: "Phoenix, Arizona", founded: 2019, features: { eld_compliance: false }, integrations: [] },
  },
  toneCredit: { recommended: 100, neutral: 50, negative: 25, not_recommended: 0 },
  knownIntegrations: ["QuickBooks", "WEX", "Comdata", "Salesforce", "SAP", "Oracle"],
};

export function record(text: string, extra: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    id: "r_test",
    week: 1,
    engine: "chatgpt",
    promptId: "P01",
    run: 1,
    collectedAt: null,
    text,
    citations: [],
    failed: false,
    sourceFile: "test",
    ...extra,
  };
}
