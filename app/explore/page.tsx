import { tryGetAnalysis } from "@/lib";
import ExploreView from "../views/ExploreView";
import ClientData from "../ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <ExploreView analysis={analysis} sp={sp} /> : <ClientData view="explore" sp={sp} />;
}
