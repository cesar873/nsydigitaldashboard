import { PHASE } from "@/lib/config";
import { monthIso, monthRange, periodLabel, priorPeriod } from "@/lib/months";

export type ResolvedRange = {
  fromIso: string;
  toIso: string;
  /** Months in the global range. */
  rangeMonths: string[];
  /** Months the KPI strip / snapshot cards read. */
  selectedMonths: string[];
  priorMonths: string[];
  periodLabel: string;
  lastActualMonthIso: string | null;
  /** Index into rangeMonths where forecast begins, or -1. */
  firstForecastIndex: number;
  minIso: string;
  maxIso: string;
};

export type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Phase 1: `to` is clamped to the last actual month and forecast months are
 * disabled in the picker. Phase 2+ extends `to` three months past actuals.
 */
export function resolveRange({
  searchParams,
  dataMonths,
  lastActualMonthIso,
}: {
  searchParams: SearchParams;
  dataMonths: string[];
  lastActualMonthIso: string | null;
}): ResolvedRange {
  const sorted = [...new Set(dataMonths)].sort();
  const earliest = sorted[0] ?? "2024-01-01";
  const latestInSheet = sorted[sorted.length - 1] ?? earliest;

  const lastActual = lastActualMonthIso ?? latestInSheet;
  const maxIso = PHASE === 1 ? lastActual : latestInSheet;

  // Default view is the whole planning year — the calendar year the last actual
  // month falls in — so the tab opens on Jan → Dec without a query string.
  const planningYear = Number(lastActual.slice(0, 4));
  const defaultFrom = monthIso(planningYear, 0);
  const defaultTo = monthIso(planningYear, 11);

  const clamp = (iso: string) => (iso < earliest ? earliest : iso > maxIso ? maxIso : iso);

  let fromIso = clamp(firstParam(searchParams, "from") ?? defaultFrom);
  let toIso = clamp(firstParam(searchParams, "to") ?? defaultTo);
  if (fromIso > toIso) [fromIso, toIso] = [toIso, fromIso];

  const rangeMonths = monthRange(fromIso, toIso);

  // Single-month default = last actual month (tabs.md Phase 1 rule 2).
  const monthsParam = firstParam(searchParams, "months");
  const requested = monthsParam
    ? monthsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const selectedMonths =
    requested.length > 0
      ? requested.filter((m) => m >= earliest && m <= maxIso).sort()
      : [lastActual];

  const firstForecastIndex =
    PHASE === 1 ? -1 : rangeMonths.findIndex((m) => m > lastActual);

  return {
    fromIso,
    toIso,
    rangeMonths,
    selectedMonths,
    priorMonths: priorPeriod(selectedMonths),
    periodLabel: periodLabel(selectedMonths),
    lastActualMonthIso: lastActual,
    firstForecastIndex,
    minIso: earliest,
    maxIso,
  };
}
