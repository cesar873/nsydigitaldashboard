import { CardShell } from "@/components/ui/CardShell";
import { EmptyChart } from "@/components/ui/EmptyState";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { PageHero } from "@/components/layout/PageHero";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { SheetError } from "@/components/ui/SheetError";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { WhatToDoNext } from "@/components/ui/WhatToDoNext";
import { MonthMatrixTable, type MatrixRow } from "@/components/tables/MonthMatrixTable";
import { resolveRange, type SearchParams } from "@/lib/default-range";
import { formatMonthShort, periodLabel } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { generateWhatToDoNextRevenue } from "@/lib/insights/revenue";
import {
  getClientRevenue,
  monthlyByDimension,
  revenueByDimension,
} from "@/lib/sources/client-revenue";
import { getLastActualMonth } from "@/lib/sources/stats";

export const revalidate = 300;
export const metadata = { title: "Revenue · Finance Dashboard" };

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let data, lastActual;
  try {
    [data, lastActual] = await Promise.all([getClientRevenue(), getLastActualMonth()]);
  } catch (err) {
    return <SheetError error={err} tab="Services" />;
  }

  if (data.months.length === 0) {
    return (
      <SheetError
        error={new Error("No month columns found in the Services tab. Check the tab name in lib/config.ts.")}
        tab="Services"
      />
    );
  }

  const range = resolveRange({
    searchParams: sp,
    dataMonths: data.months,
    lastActualMonthIso: lastActual,
  });

  const sumFor = (months: string[]) =>
    data.rows.reduce(
      (acc, r) => acc + months.reduce((a, m) => a + (r.byMonth.get(m) ?? 0), 0),
      0,
    );

  const perClient = (months: string[]) => {
    const out = new Map<string, number>();
    for (const r of data.rows) {
      const v = months.reduce((a, m) => a + (r.byMonth.get(m) ?? 0), 0);
      if (v !== 0) out.set(r.client, (out.get(r.client) ?? 0) + v);
    }
    return out;
  };

  const curClients = perClient(range.selectedMonths);
  const hasPrior = range.priorMonths.every((m) => data.months.includes(m));
  const priorClients = hasPrior ? perClient(range.priorMonths) : new Map<string, number>();
  const priorLabel = hasPrior ? periodLabel(range.priorMonths) : "no prior period";
  const deltaLabel = hasPrior ? `vs ${priorLabel}` : "no prior period";

  const total = sumFor(range.selectedMonths);
  const priorTotal = hasPrior ? sumFor(range.priorMonths) : 0;
  const activeClients = curClients.size;
  const avgPerClient = activeClients > 0 ? total / activeClients : 0;
  const newClients = [...curClients.keys()].filter((c) => !priorClients.has(c)).length;

  const ranked = [...curClients.values()].sort((a, b) => b - a);
  const top3Share =
    total > 0 ? ranked.slice(0, 3).reduce((a, b) => a + b, 0) / total : 0;
  const concentrationTone: Tone =
    top3Share <= 0.4 ? "success" : top3Share <= 0.6 ? "warning" : "danger";

  // Primary chart: monthly stack by service line.
  const byService = monthlyByDimension(data, "service", range.rangeMonths);
  const stackRows = byService.rows.map((r) => ({
    ...r,
    label: formatMonthShort(String(r.label)),
  }));

  // Snapshot breakdowns read the selected month(s), not the whole range.
  const serviceSnapshot = revenueByDimension(data, "service", range.selectedMonths);
  const intensitySnapshot = revenueByDimension(data, "intensity", range.selectedMonths);
  const sourceSnapshot = revenueByDimension(data, "source", range.selectedMonths);

  // One row per service contract, matching the Services tab's own granularity.
  const tableRows: MatrixRow[] = data.rows.map((r, i) => ({
    key: `${r.client}::${r.service}::${i}`,
    primary: r.client,
    secondary: r.service || "Unspecified",
    status: r.status || undefined,
    details: {
      intensity: r.intensity || "",
      source: r.source || "",
      startDate: r.startDate || "",
      endDate: r.endDate || "",
    },
    byMonth: r.byMonth,
  }));

  const tableColumns = range.rangeMonths.map((m) => ({
    iso: m,
    label: formatMonthShort(m),
    isForecast: !!range.lastActualMonthIso && m > range.lastActualMonthIso,
  }));

  const delta = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));

  return (
    <>
      <GlobalFiltersBar
        allMonths={data.months}
        selectedMonths={range.selectedMonths}
        fromIso={range.fromIso}
        toIso={range.toIso}
        minIso={range.minIso}
        maxIso={range.maxIso}
        lastActualMonthIso={range.lastActualMonthIso}
      />

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Service revenue"
          title="Revenue"
          period={range.periodLabel}
          source="Services"
        />

        <WhatToDoNext
          periodLabel={range.periodLabel}
          insights={generateWhatToDoNextRevenue(
            data,
            range.selectedMonths,
            hasPrior ? range.priorMonths : [],
            priorLabel,
          )}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Revenue"
            value={formatCurrency(total, { compact: true })}
            delta={hasPrior ? delta(total, priorTotal) : null}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Active Clients"
            value={String(activeClients)}
            delta={hasPrior ? delta(activeClients, priorClients.size) : null}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Avg / Client"
            value={formatCurrency(avgPerClient, { compact: true })}
            delta={
              hasPrior && priorClients.size > 0
                ? delta(avgPerClient, priorTotal / priorClients.size)
                : null
            }
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="New Clients"
            value={String(newClients)}
            tone={newClients > 0 ? "success" : "neutral"}
          />
          <KpiStat
            label="Top-3 Share"
            value={total > 0 ? formatPercent(top3Share) : "—"}
            tone={concentrationTone}
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Revenue by service line"
            subtitle="Stacked monthly · biggest service at the base"
          >
            {stackRows.length === 0 ? (
              <EmptyChart message="No revenue in the selected range." />
            ) : (
              <StackedBarChart
                data={stackRows}
                series={byService.keys.map((k) => ({ key: k, name: k }))}
                paletteSort="blue"
                format="currency"
                firstForecastIndex={range.firstForecastIndex}
              />
            )}
          </CardShell>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <CardShell title="By service" className="flex h-full flex-col">
            {serviceSnapshot.length === 0 ? (
              <EmptyChart height={260} message="No data." />
            ) : (
              <RankedBarChart data={serviceSnapshot} color="#1390eb" />
            )}
          </CardShell>
          <CardShell title="By intensity" className="flex h-full flex-col">
            {intensitySnapshot.length === 0 ? (
              <EmptyChart height={260} message="No data." />
            ) : (
              <RankedBarChart data={intensitySnapshot} color="#22c55e" />
            )}
          </CardShell>
          <CardShell title="By source" className="flex h-full flex-col">
            {sourceSnapshot.length === 0 ? (
              <EmptyChart height={260} message="No data." />
            ) : (
              <RankedBarChart data={sourceSnapshot} color="#c084fc" />
            )}
          </CardShell>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Revenue by client × service × month</h2>
            <span className="text-[11px] text-muted-foreground">
              One row per service contract · scroll for full history
            </span>
          </div>
          <MonthMatrixTable
            rows={tableRows}
            columns={tableColumns}
            primaryLabel="Client"
            secondaryLabel="Service"
            showStatus
            defaultStatus={["Active"]}
            detailColumns={[
              { key: "intensity", label: "Intensity", width: 100 },
              { key: "source", label: "Source", width: 120 },
              { key: "startDate", label: "Start", width: 100 },
              { key: "endDate", label: "End", width: 100 },
            ]}
            searchPlaceholder="Search client…"
            filterLabel="Service"
            accent="sky"
            shareLabel="% of total"
          />
        </section>

        <LiveFooter sources="Services + Clients" />
      </div>
    </>
  );
}
