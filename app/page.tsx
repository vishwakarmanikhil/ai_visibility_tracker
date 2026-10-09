import { tryGetAnalysis } from "@/lib";
import MondayView from "./views/MondayView";
import ClientData from "./ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <MondayView analysis={analysis} sp={sp} /> : <ClientData view="monday" sp={sp} />;
}
