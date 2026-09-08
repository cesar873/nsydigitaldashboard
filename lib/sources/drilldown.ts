import { TABS } from "@/lib/config";
import { formatMonthLong, parseMonthLabel } from "@/lib/months";
import { getClientRevenue } from "./client-revenue";
import type { DrillRequest, DrillResult, DrillRow } from "@/lib/drilldown-types";

export type {
  DrillDimension, DrillRequest, DrillRow, DrillResult,
} from "@/lib/drilldown-types";

function periodLabel(months: string[]): string {
  if (months.length === 0) return "";
  if (months.length === 1) return formatMonthLong(months[0]);
  const sorted = [...months].sort();
  return `${formatMonthLong(sorted[0])} → ${formatMonthLong(sorted[sorted.length - 1])}`;
}

/**
 * Which clients make up a signed / lost count. Resolved from the Services tab's
 * start and end dates — the same source the count itself comes from, so the list
 * always reconciles with the number clicked.
 */
export async function resolveDrillDown(req: DrillRequest): Promise<DrillResult> {
  const services = await getClientRevenue();
  const months = [...new Set(req.months)].sort();
  const monthSet = new Set(months);
  const wantSigned = req.dimension === "clientsSigned";

  const rows: DrillRow[] = [];
  for (const r of services.rows) {
    const raw = wantSigned ? r.startDate : r.endDate;
    if (!raw) continue;
    const month = parseMonthLabel(raw);
    if (!month || !monthSet.has(month)) continue;
    rows.push({
      date: raw,
      client: r.client,
      service: r.service || "—",
      detail: [r.intensity, r.source].filter(Boolean).join(" · "),
      month,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    title: wantSigned ? "Clients signed" : "Clients lost",
    subtitle: periodLabel(months),
    source: TABS.services,
    note: `Counted from each client's ${wantSigned ? "start" : "end"} date.`,
    rows,
    total: rows.length,
  };
}
