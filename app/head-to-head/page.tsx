import { tryGetAnalysis } from "@/lib";
import HeadToHeadView from "../views/HeadToHeadView";
import ClientData from "../ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <HeadToHeadView analysis={analysis} sp={sp} /> : <ClientData view="head-to-head" sp={sp} />;
}
