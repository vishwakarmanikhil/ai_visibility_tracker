import { tryGetAnalysis } from "@/lib";
import MethodView from "../views/MethodView";
import ClientData from "../ClientData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const analysis = tryGetAnalysis();
  return analysis ? <MethodView analysis={analysis} sp={sp} /> : <ClientData view="method" sp={sp} />;
}
