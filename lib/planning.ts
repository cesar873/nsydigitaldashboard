import type { IncomeSummary } from "@/lib/sources/income-summary";
import { rowFor } from "@/lib/sources/income-summary";

export type GoalKey =
  | "revenue"
  | "grossProfit"
  | "operatingProfit"
  | "netProfit"
  | "ownerDrawing"
  | "clients";

export type GoalDef = {
  key: GoalKey;
  label: string;
  /** Exact sheet row labels, tried in order. */
  labels: string[];
  format: "currency" | "number";
  /** Sum across months, or take the last month (for balances/counts). */
  aggregate: "sum" | "endOfPeriod";
};

/** The five goals the Planning tab tracks, plus net profit. */
export const GOALS: GoalDef[] = [
  { key: "revenue", label: "Revenue", labels: ["TOTAL REVENUE"], format: "currency", aggregate: "sum" },
  { key: "grossProfit", label: "Gross Profit", labels: ["GROSS PROFIT"], format: "currency", aggregate: "sum" },
  { key: "operatingProfit", label: "Operating Profit", labels: ["OPERATING PROFIT"], format: "currency", aggregate: "sum" },
  { key: "netProfit", label: "Net Profit", labels: ["NET PROFIT"], format: "currency", aggregate: "sum" },
  { key: "ownerDrawing", label: "Owner Drawing", labels: ["Owner", "Owner's Spend"], format: "currency", aggregate: "sum" },
  { key: "clients", label: "Clients", labels: [], format: "number", aggregate: "endOfPeriod" },
];

/** Client count is the sum of the per-service "<X> Clients" driver rows. */
export function clientCountSeries(summary: IncomeSummary): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of summary.months) out.set(m, 0);
  for (const row of summary.rows.values()) {
    if (row.kind !== "detail") continue;
    if (!/\bclients$/i.test(row.label)) continue;
    if (/\b(new|lost)\b/i.test(row.label)) continue;
    for (const m of summary.months) {
      out.set(m, (out.get(m) ?? 0) + (row.byMonth.get(m) ?? 0));
    }
  }
  return out;
}

export function goalSeries(summary: IncomeSummary, goal: GoalDef): Map<string, number> {
  if (goal.key === "clients") return clientCountSeries(summary);
  for (const label of goal.labels) {
    const row = rowFor(summary, label);
    if (row) return row.byMonth;
  }
  return new Map();
}

export function aggregate(
  series: Map<string, number>,
  months: string[],
  mode: GoalDef["aggregate"],
): number {
  if (months.length === 0) return 0;
  if (mode === "endOfPeriod") return series.get(months[months.length - 1]) ?? 0;
  return months.reduce((acc, m) => acc + (series.get(m) ?? 0), 0);
}

/** Calendar months of a year that exist in the sheet. */
export function yearMonths(summary: IncomeSummary, year: number): string[] {
  return summary.months.filter((m) => m.startsWith(String(year))).sort();
}

/**
 * Fraction of the year elapsed, measured to the END of the last actual month.
 * Used for the pace line: 70% through the year → expect 70% of the goal.
 */
export function yearElapsedFraction(year: number, lastActualMonthIso: string | null): number {
  if (!lastActualMonthIso) return 0;
  const [ly, lm] = lastActualMonthIso.split("-").map(Number);
  if (ly < year) return 0;
  if (ly > year) return 1;
  const endOfMonth = new Date(Date.UTC(year, lm, 0));
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = (endOfMonth.getTime() - startOfYear) / 86_400_000 + 1;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - startOfYear) / 86_400_000;
  return Math.min(1, Math.max(0, dayOfYear / daysInYear));
}

export type GoalStatus = "ahead" | "on" | "behind";

export type GoalProgress = {
  def: GoalDef;
  fyPlanned: number;
  fyRunRate: number;
  difference: number;
  ytdActual: number;
  ytdPlanned: number;
  /** Still to book to reach the full-year plan. */
  toGo: number;
  /** Of `toGo`, how much the current book already covers (contracted). */
  contracted: number;
  /** YTD actual as a share of the full-year plan. */
  completion: number;
  /** Linear pace: fraction of the year elapsed. */
  paceFraction: number;
  /**
   * Where the scenario itself says we should be by now, as a share of the
   * full-year plan. Differs from paceFraction whenever the plan is
   * front- or back-loaded — which is why status is judged against this.
   */
  planToDateFraction: number;
  status: GoalStatus;
};

export function computeGoal({
  def,
  actuals,
  plan,
  months,
  actualMonths,
  paceFraction,
}: {
  def: GoalDef;
  actuals: IncomeSummary;
  plan: IncomeSummary;
  months: string[];
  actualMonths: string[];
  paceFraction: number;
}): GoalProgress {
  const actualSeries = goalSeries(actuals, def);
  const planSeries = goalSeries(plan, def);

  const fyRunRate = aggregate(actualSeries, months, def.aggregate);
  const fyPlanned = aggregate(planSeries, months, def.aggregate);
  const ytdActual = aggregate(actualSeries, actualMonths, def.aggregate);
  const ytdPlanned = aggregate(planSeries, actualMonths, def.aggregate);

  const completion = fyPlanned !== 0 ? ytdActual / fyPlanned : 0;
  const planToDateFraction = fyPlanned !== 0 ? ytdPlanned / fyPlanned : 0;

  // Judged against the plan's own schedule, with a 2% dead band so a rounding
  // difference doesn't read as a miss.
  let status: GoalStatus = "on";
  if (ytdPlanned !== 0) {
    const ratio = ytdActual / ytdPlanned;
    if (ratio > 1.02) status = "ahead";
    else if (ratio < 0.98) status = "behind";
  } else if (ytdActual !== 0) {
    status = ytdActual > 0 ? "ahead" : "behind";
  }

  return {
    def,
    fyPlanned,
    fyRunRate,
    difference: fyRunRate - fyPlanned,
    ytdActual,
    ytdPlanned,
    // What is left to reach the goal, and how much of it is already on the books.
    toGo: Math.max(0, fyPlanned - ytdActual),
    contracted: Math.max(0, fyRunRate - ytdActual),
    completion,
    paceFraction,
    planToDateFraction,
    status,
  };
}
