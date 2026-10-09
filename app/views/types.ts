import type { Analysis } from "@/lib/dataset";

/** Every page body is a pure view of the analysis, so it can render on the server or in the browser. */
export interface ViewProps {
  analysis: Analysis;
  sp: Record<string, string | undefined>;
}
