import { CardShell } from "@/components/ui/CardShell";
import { EmptyChart } from "@/components/ui/EmptyState";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { MetricMatrixTable } from "@/components/tables/MetricMatrixTable";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { PageHero } from "@/components/layout/PageHero";
import { SignedLostBars } from "@/components/charts/SignedLostBars";
import { SheetError } from "@/components/ui/SheetError";
import { WhatToDoNext } from "@/components/ui/WhatToDoNext";
import { generateWhatToDoNextAnalytics } from "@/lib/insights/analytics";
import { formatMonthShort, periodLabel } from "@/lib/months";
import { resolveRange, type SearchParams } from "@/lib/default-range";
import {
  formatMetric, getMetrics, metricBy, metricValue, type Metric,
} from "@/lib/sources/analytics";
import { getIncomeSummary, type IncomeSummary } from "@/lib/sources/income-summary";
import { getLastActualMonth } from "@/lib/sources/stats";

export const revalidate = 300;
export const metadata = { title: "Analytics · Finance Dashboard" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let summary: IncomeSummary;
  let lastActual: string | null;
  try {
    [summary, lastActual] = await Promise.all([getIncomeSummary(), getLastActualMonth()]);
  } catch (err) {
    return <SheetError error={err} tab="Finance Model" />;
  }

  if (summary.months.length === 0) {
    return (
      <SheetError
        error={new Error("No month columns found in the Finance Model tab.")}
        tab="Finance Model"
      />
    );
  }

  const lastActualIso = lastActual ?? [...summary.actualMonths].sort().at(-1) ?? null;
  const range = resolveRange({
    searchParams: sp,
    dataMonths: summary.months,
    lastActualMonthIso: lastActualIso,
  });

  const metrics = getMetrics(summary);
  if (metrics.length === 0) {
    return (
      <SheetError
        error={new Error("No metric rows found in the Finance Model tab (expected Lifetime Value, CAC, Churn Rate, …).")}
        tab="Finance Model"
      />
    );
  }

  const hasPrior = range.priorMonths.every((m) => summary.months.includes(m));
  const priorLabel = hasPrior ? periodLabel(range.priorMonths) : "no prior period";
  const deltaLabel = hasPrior ? `vs ${priorLabel}` : "no prior period";

  const val = (key: string, months: string[]) => metricValue(metricBy(metrics, key), months);
  const delta = (key: string) => {
    if (!hasPrior) return null;
    const cur = val(key, range.selectedMonths);
    const prev = val(key, range.priorMonths);
    if (cur === null || prev === null || prev === 0) return null;
    return (cur - prev) / Math.abs(prev);
  };

  function kpi(key: string, label: string, tone?: (v: number) => Tone, inverse = false) {
    const metric = metricBy(metrics, key);
    const value = val(key, range.selectedMonths);
    return {
      key,
      label,
      value: metric && value !== null ? formatMetric(value, metric.format) : "—",
      tone: tone && value !== null ? tone(value) : ("neutral" as Tone),
      delta: delta(key),
      inverse,
    };
  }

  const kpis = [
    kpi("ltv", "LTV"),
    kpi("cac", "CAC", undefined, true),
    kpi("ltvCac", "LTV / CAC", (v) => (v >= 3 ? "success" : v >= 1 ? "warning" : "danger")),
    kpi("avgInvoice", "Avg Invoice"),
    kpi("churn", "Churn", undefined, true),
    kpi("churnMrr", "Churn MRR", undefined, true),
  ].filter((k) => k.value !== "—");

  const isForecast = (m: string) => !!lastActualIso && m > lastActualIso;

  const chartRows = (keys: string[]) =>
    range.rangeMonths.map((m) => {
      const row: Record<string, string | number> = { label: formatMonthShort(m) };
      for (const key of keys) {
        row[key] = metricBy(metrics, key)?.byMonth.get(m) ?? 0;
      }
      return row;
    });

  const ltvCacRows = chartRows(["ltv", "cac"]);
  const churnRows = chartRows(["churn", "churnMrr"]);

  const signedLost = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    monthIso: m,
    signed: metricBy(metrics, "clientsSigned")?.byMonth.get(m) ?? 0,
    lost: metricBy(metrics, "clientsLost")?.byMonth.get(m) ?? 0,
    total: metricBy(metrics, "totalClients")?.byMonth.get(m) ?? 0,
    isForecast: isForecast(m),
  }));

  const tableColumns = range.rangeMonths.map((m) => ({
    iso: m,
    label: formatMonthShort(m),
    isForecast: isForecast(m),
  }));

  const has = (key: string) => metrics.some((m: Metric) => m.key === key);

  return (
    <>
      <GlobalFiltersBar
        allMonths={summary.months}
        selectedMonths={range.selectedMonths}
        fromIso={range.fromIso}
        toIso={range.toIso}
        minIso={range.minIso}
        maxIso={range.maxIso}
        lastActualMonthIso={range.lastActualMonthIso}
      />

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Unit economics"
          title="Analytics"
          period={range.periodLabel}
          source="Finance Model"
        />

        <WhatToDoNext
          periodLabel={range.periodLabel}
          insights={generateWhatToDoNextAnalytics({
            metrics,
            selected: range.selectedMonths,
            prior: hasPrior ? range.priorMonths : [],
            priorLabel,
            hasPrior,
          })}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <KpiStat
              key={k.key}
              label={k.label}
              value={k.value}
              tone={k.tone}
              delta={k.delta}
              deltaLabel={deltaLabel}
              deltaInverse={k.inverse}
            />
          ))}
        </section>

        {has("ltv") && has("cac") && (
          <section className="mt-8">
            <CardShell
              title="LTV vs CAC"
              subtitle="Lifetime value over acquisition cost — the gap is unit-economics health"
            >
              <MultiLineChart
                data={ltvCacRows}
                leftFormat="currency"
                firstForecastIndex={range.firstForecastIndex}
                series={[
                  { key: "ltv", name: "LTV", color: "#1390eb", format: "currency" },
                  { key: "cac", name: "CAC", color: "#ef4444", format: "currency" },
                ]}
              />
            </CardShell>
          </section>
        )}

        {has("churn") && (
          <section className="mt-6">
            <CardShell
              title="Churn"
              subtitle="Client churn vs revenue churn — they diverge when the clients leaving are not the ones carrying the revenue"
            >
              <MultiLineChart
                data={churnRows}
                leftFormat="percent"
                firstForecastIndex={range.firstForecastIndex}
                series={[
                  { key: "churn", name: "Churn", color: "#ef4444", format: "percent" },
                  ...(has("churnMrr")
                    ? [{ key: "churnMrr", name: "Churn MRR", color: "#f59e0b", format: "percent" as const }]
                    : []),
                ]}
              />
            </CardShell>
          </section>
        )}

        {has("clientsSigned") && (
          <section className="mt-6">
            <CardShell
              title="Signed & lost clients"
              subtitle="Bars: monthly signs and losses · line: total clients on the books"
            >
              {signedLost.length === 0 ? (
                <EmptyChart message="No client movement in the selected range." />
              ) : (
                <SignedLostBars data={signedLost} />
              )}
            </CardShell>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">All metrics by month</h2>
            <span className="text-[11px] text-muted-foreground">
              Every metric from the Finance Model · heat is scaled within each row
            </span>
          </div>
          <MetricMatrixTable metrics={metrics} columns={tableColumns} />
        </section>

        <LiveFooter sources="Finance Model" />
      </div>
    </>
  );
}
