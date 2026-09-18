import type { IncomeSummary } from "@/lib/sources/income-summary";
import { rowFor } from "@/lib/sources/income-summary";
import type { ClientRevenue } from "@/lib/sources/client-revenue";
import { parseMonthLabel } from "@/lib/months";
import type { Driver, DriverKey, DriverMonth } from "@/lib/driver-types";

export type {
  Driver, DriverKey, DriverMonth, DriverStatus, DriverView,
} from "@/lib/driver-types";
export { viewDriver, monthElapsedFraction } from "@/lib/driver-types";

/** Sums every driver row whose label matches, e.g. all "<X> New Clients". */
function sumDriverRows(
  summary: IncomeSummary,
  match: (label: string) => boolean,
  months: string[],
): Map<string, number> {
  const out = new Map(months.map((m) => [m, 0]));
  for (const row of summary.rows.values()) {
    if (row.kind !== "detail" || !match(row.label)) continue;
    for (const m of months) out.set(m, (out.get(m) ?? 0) + (row.byMonth.get(m) ?? 0));
  }
  return out;
}

function planRetainer(plan: IncomeSummary, months: string[]): Map<string, number> {
  const revenue = rowFor(plan, "TOTAL REVENUE");
  const clients = sumDriverRows(
    plan,
    (l) => /\bclients$/i.test(l) && !/\b(new|lost)\b/i.test(l),
    months,
  );
  const out = new Map<string, number>();
  for (const m of months) {
    const c = clients.get(m) ?? 0;
    out.set(m, c === 0 ? 0 : (revenue?.byMonth.get(m) ?? 0) / c);
  }
  return out;
}

/** Live counts straight off the Services roster's start / end dates. */
function liveClientMovement(services: ClientRevenue, months: string[]) {
  const signed = new Map(months.map((m) => [m, 0]));
  const lost = new Map(months.map((m) => [m, 0]));
  for (const row of services.rows) {
    const start = row.startDate ? parseMonthLabel(row.startDate) : null;
    if (start && signed.has(start)) signed.set(start, (signed.get(start) ?? 0) + 1);
    const end = row.endDate ? parseMonthLabel(row.endDate) : null;
    if (end && lost.has(end)) lost.set(end, (lost.get(end) ?? 0) + 1);
  }
  return { signed, lost };
}

/** Live client count: how many of the roster are actually billing that month. */
function liveClientCount(services: ClientRevenue, months: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of months) {
    let count = 0;
    for (const row of services.rows) if ((row.byMonth.get(m) ?? 0) !== 0) count++;
    out.set(m, count);
  }
  return out;
}

/** Live average retainer: what the roster is actually billing that month. */
function liveRetainer(services: ClientRevenue, months: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of months) {
    let total = 0;
    let count = 0;
    for (const row of services.rows) {
      const amount = row.byMonth.get(m) ?? 0;
      if (amount === 0) continue;
      total += amount;
      count++;
    }
    out.set(m, count === 0 ? 0 : total / count);
  }
  return out;
}

function phaseOf(monthIso: string, currentMonthIso: string): DriverMonth["phase"] {
  if (monthIso < currentMonthIso) return "closed";
  if (monthIso === currentMonthIso) return "current";
  return "upcoming";
}

function seriesOf(summary: IncomeSummary, label: string, months: string[]): Map<string, number> {
  const row = rowFor(summary, label);
  return new Map(months.map((m) => [m, row?.byMonth.get(m) ?? 0]));
}

export function buildDrivers({
  plan,
  actuals,
  services,
  months,
  currentMonthIso,
}: {
  plan: IncomeSummary;
  actuals: IncomeSummary;
  services: ClientRevenue;
  months: string[];
  currentMonthIso: string;
}): Driver[] {
  const planSigned = sumDriverRows(plan, (l) => /\bnew clients$/i.test(l), months);
  const planLost = sumDriverRows(plan, (l) => /\blost clients$/i.test(l), months);
  const planRet = planRetainer(plan, months);
  const planClients = sumDriverRows(
    plan,
    (l) => /\bclients$/i.test(l) && !/\b(new|lost)\b/i.test(l),
    months,
  );
  const live = liveClientMovement(services, months);
  const liveRet = liveRetainer(services, months);
  const liveClients = liveClientCount(services, months);

  const build = (
    key: DriverKey,
    label: string,
    unit: Driver["unit"],
    target: Map<string, number>,
    actual: Map<string, number>,
    opts: { inverse?: boolean; carries: boolean; onBoard?: boolean; sourceNote?: string },
  ): Driver => ({
    key,
    label,
    unit,
    inverse: opts.inverse,
    carries: opts.carries,
    onBoard: opts.onBoard,
    sourceNote: opts.sourceNote,
    months: months.map((m) => ({
      monthIso: m,
      target: target.get(m) ?? 0,
      actual: actual.get(m) ?? 0,
      phase: phaseOf(m, currentMonthIso),
    })),
  });

  return [
    build(
      "revenue",
      "Total revenue",
      "currency",
      seriesOf(plan, "TOTAL REVENUE", months),
      // Accrual: the Finance Model carries deferred income the Services roster
      // never sees, so revenue actuals read the model, not the live book — this
      // also keeps Total revenue reconciled with the scorecard and the plan.
      seriesOf(actuals, "TOTAL REVENUE", months),
      { carries: true, onBoard: true, sourceNote: "from Finance Model" },
    ),
    // Services cannot produce a profit figure, so this one reads the model.
    build(
      "profit",
      "Operating profit",
      "currency",
      seriesOf(plan, "OPERATING PROFIT", months),
      seriesOf(actuals, "OPERATING PROFIT", months),
      { carries: true, sourceNote: "from Finance Model" },
    ),
    // A level, not a flow — the count already reflects everything that happened,
    // so it never carries a separate shortfall.
    build("clients", "Total clients", "count", planClients, liveClients, {
      carries: false,
      onBoard: true,
      sourceNote: "billing this month",
    }),
    build("signed", "Clients to sign", "count", planSigned, live.signed, {
      carries: true,
      onBoard: true,
      sourceNote: "start dates",
    }),
    build("lost", "Churn allowance", "count", planLost, live.lost, {
      inverse: true,
      carries: true,
      onBoard: true,
      sourceNote: "end dates",
    }),
    build("retainer", "Avg retainer", "currency", planRet, liveRet, {
      carries: false,
      onBoard: true,
      sourceNote: "revenue / clients",
    }),
  ];
}

