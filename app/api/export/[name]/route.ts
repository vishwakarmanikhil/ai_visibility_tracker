import { getAnalysis } from "@/lib";
import { mentionsCsv, wrongFactsCsv } from "@/lib/exports";
import { boardReportCsv } from "@/lib/report";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const analysis = getAnalysis();
  const files: Record<string, () => string> = {
    "mentions.csv": () => mentionsCsv(analysis.responses),
    "wrong_facts.csv": () => wrongFactsCsv(analysis.responses, analysis.config),
    "board_report.csv": () => boardReportCsv(analysis),
  };
  const make = files[name];
  if (!make) return new Response("Not found", { status: 404 });
  return new Response(make(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
