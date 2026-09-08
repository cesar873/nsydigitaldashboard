import type { IncomeSummary } from "./income-summary";
import { rowFor } from "./income-summary";
import type { Metric, MetricFormat } from "@/lib/metrics";

export type { Metric, MetricFormat } from "@/lib/metrics";
export { formatMetric } from "@/lib/metrics";

function sumRows(
  summary: IncomeSummary,
  match: (label: string) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of summary.months) out.set(m, 0);
  for (const row of summary.rows.values()) {
    if (row.kind !== "detail") continue;
    if (!match(row.label)) continue;
    for (const m of summary.months) {
      out.set(m, (out.get(m) ?? 0) + (row.byMonth.get(m) ?? 0));
    }
  }
  return out;
}

/** Total clients on the books = sum of the per-service "<X> Clients" rows. */
export function totalClients(summary: IncomeSummary): Map<string, number> {
  return sumRows(
    summary,
    (l) => /\bclients$/i.test(l) && !/\b(new|lost)\b/i.test(l),
  );
}

export function clientsSigned(summary: IncomeSummary): Map<string, number> {
  return sumRows(summary, (l) => /\bnew clients$/i.test(l));
}

export function clientsLost(summary: IncomeSummary): Map<string, number> {
  return sumRows(summary, (l) => /\blost clients$/i.test(l));
}

function fromRow(summary: IncomeSummary, label: string): Map<string, number> {
  const row = rowFor(summary, label);
  const out = new Map<string, number>();
  for (const m of summary.months) out.set(m, row?.byMonth.get(m) ?? 0);
  return out;
}

/** Derived: revenue divided by clients on the books. */
function avgInvoice(summary: IncomeSummary): Map<string, number> {
  const revenue = fromRow(summary, "TOTAL REVENUE");
  const clients = totalClients(summary);
  const out = new Map<string, number>();
  for (const m of summary.months) {
    const c = clients.get(m) ?? 0;
    out.set(m, c === 0 ? 0 : (revenue.get(m) ?? 0) / c);
  }
  return out;
}

/**
 * The Finance Model's Metrics section carries "Lifetime Value" as a full
 * currency LTV, so it is read straight through. (It once held a lifetime in
 * MONTHS, which is why this used to multiply by avg invoice — that derivation
 * would now inflate LTV by roughly the retainer.)
 */
function ltvValue(summary: IncomeSummary): Map<string, number> {
  return fromRow(summary, "Lifetime Value");
}

/** Derived: LTV over CAC. Zero CAC yields zero rather than Infinity. */
function ltvOverCac(summary: IncomeSummary): Map<string, number> {
  const ltv = ltvValue(summary);
  const cac = fromRow(summary, "CAC");
  const out = new Map<string, number>();
  for (const m of summary.months) {
    const c = cac.get(m) ?? 0;
    out.set(m, c === 0 ? 0 : (ltv.get(m) ?? 0) / c);
  }
  return out;
}

/**
 * Every analytics metric, all sourced from the Finance Model tab. Rows the
 * sheet doesn't carry are simply absent rather than fabricated.
 */
export function getMetrics(summary: IncomeSummary): Metric[] {
  const defs: { key: string; label: string; format: MetricFormat; inverse?: boolean; series: Map<string, number> }[] = [
    { key: "grossMargin", label: "Gross Margin", format: "percent", series: fromRow(summary, "Gross Margin") },
    { key: "operatingMargin", label: "Operating Margin", format: "percent", series: fromRow(summary, "Operating Margin") },
    { key: "operatingProfit", label: "Operating Profit", format: "currency", series: fromRow(summary, "OPERATING PROFIT") },
    { key: "burnRate", label: "Burn Rate", format: "number", series: fromRow(summary, "Burn Rate") },
    { key: "totalClients", label: "Total Clients", format: "number", series: totalClients(summary) },
    { key: "clientsSigned", label: "Clients Signed", format: "number", series: clientsSigned(summary) },
    { key: "clientsLost", label: "Clients Lost", format: "number", inverse: true, series: clientsLost(summary) },
    { key: "churn", label: "Churn", format: "percent", inverse: true, series: fromRow(summary, "Churn Rate") },
    { key: "churnMrr", label: "Churn MRR", format: "percent", inverse: true, series: fromRow(summary, "Churn MRR") },
    { key: "avgInvoice", label: "Avg Invoice", format: "currency", series: avgInvoice(summary) },
    { key: "ltv", label: "LTV", format: "currency", series: ltvValue(summary) },
    { key: "cac", label: "CAC", format: "currency", inverse: true, series: fromRow(summary, "CAC") },
    { key: "ltvCac", label: "LTV / CAC", format: "ratio", series: ltvOverCac(summary) },
    { key: "teamMembers", label: "Team Members", format: "number", series: fromRow(summary, "Team Members") },
    { key: "revPerEmployee", label: "Revenue / Employee", format: "currency", series: fromRow(summary, "Revenue per Employee") },
  ];

  return defs
    // Drop metrics that are empty across the whole sheet.
    .filter((d) => [...d.series.values()].some((v) => v !== 0))
    .map((d) => ({
      key: d.key,
      label: d.label,
      format: d.format,
      inverse: d.inverse,
      byMonth: d.series,
    }));
}

export function metricBy(metrics: Metric[], key: string): Metric | undefined {
  return metrics.find((m) => m.key === key);
}

/** Period value: averaged for rates and ratios, summed for flows. */
export function metricValue(metric: Metric | undefined, months: string[]): number | null {
  if (!metric || months.length === 0) return null;
  const vals = months.map((m) => metric.byMonth.get(m) ?? 0);
  const isRate =
    metric.format === "percent" ||
    metric.format === "ratio" ||
    [
      "ltv", "cac", "avgInvoice", "burnRate", "totalClients", "teamMembers",
      "revPerEmployee",
    ].includes(metric.key);
  if (isRate) {
    // A level, not an accumulation — take the latest month in the period.
    return vals[vals.length - 1];
  }
  return vals.reduce((a, b) => a + b, 0);
}
