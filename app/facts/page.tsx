import { tryGetAnalysis } from "@/lib";
import FactsView from "../views/FactsView";
import ClientData from "../ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <FactsView analysis={analysis} sp={sp} /> : <ClientData view="facts" sp={sp} />;
}
