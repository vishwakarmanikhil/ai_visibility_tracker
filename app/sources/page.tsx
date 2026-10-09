import { tryGetAnalysis } from "@/lib";
import SourcesView from "../views/SourcesView";
import ClientData from "../ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <SourcesView analysis={analysis} sp={sp} /> : <ClientData view="sources" sp={sp} />;
}
