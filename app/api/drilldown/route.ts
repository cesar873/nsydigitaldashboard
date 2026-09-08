import { resolveDrillDown } from "@/lib/sources/drilldown";
import type { DrillRequest } from "@/lib/drilldown-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DrillRequest;
    if (!Array.isArray(body.months) || body.months.length === 0) {
      return Response.json({ error: "months is required" }, { status: 400 });
    }
    // Sheet tabs are already cached in memory, so this is a filter, not a fetch.
    const result = await resolveDrillDown(body);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drill-down failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
