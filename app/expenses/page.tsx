import { CardShell } from "@/components/ui/CardShell";
import { EmptyChart } from "@/components/ui/EmptyState";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { PageHero } from "@/components/layout/PageHero";
import { SheetError } from "@/components/ui/SheetError";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { MonthMatrixTable, type MatrixRow } from "@/components/tables/MonthMatrixTable";
import { WhatToDoNext } from "@/components/ui/WhatToDoNext";
import { resolveRange, type SearchParams } from "@/lib/default-range";
import { formatMonthShort, periodLabel } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { generateWhatToDoNextExpenses } from "@/lib/insights/expenses";
import { getIncomeSummary, seriesFor, sumMonths } from "@/lib/sources/income-summary";
import { getLastActualMonth } from "@/lib/sources/stats";
import { expenseCategories } from "@/lib/sources/expense-categories";
import {
  costByCategory,
  costByVendor,
  expenseRows,
  getTransactions,
  monthlyByCategory,
  totalCost,
} from "@/lib/sources/transactions";

export const revalidate = 300;
export const metadata = { title: "Expenses · Finance Dashboard" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let tx, summary, lastActual;
  try {
    [tx, summary, lastActual] = await Promise.all([
      getTransactions(),
      getIncomeSummary(),
      getLastActualMonth(),
    ]);
  } catch (err) {
    return <SheetError error={err} tab="Transactions" />;
  }

  const rows = expenseRows(tx);
  const txMonths = [...new Set(rows.map((r) => r.monthIso).filter((m): m is string => !!m))].sort();

  if (txMonths.length === 0) {
    return (
      <SheetError
        error={new Error("No dated expense rows found in the Transactions tab. Check the tab name in lib/config.ts.")}
        tab="Transactions"
      />
    );
  }

  // The range spans the Finance Model's months (which include forecast) unioned
  // with the ledger's, so the year view isn't truncated by the last transaction.
  // Ledger-sourced tables simply show "—" for months with no transactions.
  const dataMonths = [...new Set([...txMonths, ...summary.months])].sort();

  const range = resolveRange({
    searchParams: sp,
    dataMonths,
    lastActualMonthIso: lastActual,
  });

  const revenueSeries = seriesFor(summary, /^total revenue$/i);
  const revenue = sumMonths(revenueSeries, range.selectedMonths);

  const cur = totalCost(rows, range.selectedMonths);
  const hasPrior = range.priorMonths.every((m) => dataMonths.includes(m));
  const prior = hasPrior ? totalCost(rows, range.priorMonths) : 0;
  const priorLabel = hasPrior ? periodLabel(range.priorMonths) : "no prior period";
  const deltaLabel = hasPrior ? `vs ${priorLabel}` : "no prior period";

  const categories = costByCategory(rows, range.selectedMonths);
  const vendors = costByVendor(rows, range.selectedMonths);
  const priorVendors = new Map(
    hasPrior ? costByVendor(rows, range.priorMonths).map((v) => [v.name, v.value]) : [],
  );

  // Stacked bars read the Finance Model, not the ledger, so forecast months
  // are populated — the ledger only ever holds actuals.
  const modelCategories = expenseCategories(summary);
  const stackKeys = modelCategories.map((c) => c.label);
  const stackRows = range.rangeMonths.map((m) => {
    const row: Record<string, string | number> = { label: formatMonthShort(m) };
    for (const c of modelCategories) row[c.label] = c.byMonth.get(m) ?? 0;
    return row;
  });

  const tableColumns = range.rangeMonths.map((m) => ({
    iso: m,
    label: formatMonthShort(m),
    isForecast: !!range.lastActualMonthIso && m > range.lastActualMonthIso,
  }));

  // Revenue per month drives the "% of revenue" toggle on the category table.
  const revenueByMonth = new Map(
    range.rangeMonths.map((m) => [m, revenueSeries?.get(m) ?? 0]),
  );

  const categoryRows: MatrixRow[] = modelCategories.map((c) => ({
    key: `${c.group}::${c.label}`,
    primary: c.label,
    secondary: c.group,
    byMonth: c.byMonth,
  }));

  // All costs: one row per vendor × category, from the transaction ledger.
  const vendorMap = new Map<string, { vendor: string; category: string; byMonth: Map<string, number> }>();
  for (const t of rows) {
    if (!t.monthIso) continue;
    const vendor = t.contact || "Unknown vendor";
    const category = t.summaryCategory || t.account || "Uncategorized";
    const key = `${vendor}::${category}`;
    let entry = vendorMap.get(key);
    if (!entry) {
      entry = { vendor, category, byMonth: new Map() };
      vendorMap.set(key, entry);
    }
    entry.byMonth.set(t.monthIso, (entry.byMonth.get(t.monthIso) ?? 0) + t.net);
  }
  const allCostRows: MatrixRow[] = [...vendorMap.entries()].map(([key, v]) => ({
    key,
    primary: v.vendor,
    secondary: v.category,
    byMonth: v.byMonth,
  }));

  // The ledger holds only what has actually happened, so its columns stop at
  // the last actual month rather than running into the forecast.
  const actualColumns = tableColumns.filter((c) => !c.isForecast);

  const costRatio = revenue > 0 ? cur / revenue : null;
  const ratioTone: Tone =
    costRatio === null ? "neutral" : costRatio <= 0.5 ? "success" : costRatio <= 0.7 ? "warning" : "danger";

  const delta = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));

  return (
    <>
      <GlobalFiltersBar
        allMonths={dataMonths}
        selectedMonths={range.selectedMonths}
        fromIso={range.fromIso}
        toIso={range.toIso}
        minIso={range.minIso}
        maxIso={range.maxIso}
        lastActualMonthIso={range.lastActualMonthIso}
      />

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Costs"
          title="Expenses"
          period={range.periodLabel}
          source="Transactions + Finance Model"
        />

        <WhatToDoNext
          periodLabel={range.periodLabel}
          insights={generateWhatToDoNextExpenses(
            rows,
            range.selectedMonths,
            hasPrior ? range.priorMonths : [],
            priorLabel,
            revenue,
          )}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Expenses"
            value={formatCurrency(cur, { compact: true })}
            deltaInverse
            delta={hasPrior ? delta(cur, prior) : null}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Expenses / Revenue"
            value={costRatio === null ? "—" : formatPercent(costRatio)}
            tone={ratioTone}
          />
          <KpiStat
            label="Active Vendors"
            value={String(vendors.length)}
            delta={hasPrior ? delta(vendors.length, priorVendors.size) : null}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Categories"
            value={String(categories.length)}
          />
          <KpiStat
            label="Avg / Vendor"
            value={
              vendors.length > 0 ? formatCurrency(cur / vendors.length, { compact: true }) : "—"
            }
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Expenses by category"
            subtitle="Stacked monthly · biggest category at the base"
          >
            {stackRows.length === 0 ? (
              <EmptyChart message="No expenses in the selected range." />
            ) : (
              <StackedBarChart
                data={stackRows}
                series={stackKeys.map((k) => ({ key: k, name: k }))}
                paletteSort="red"
                format="currency"
                firstForecastIndex={range.firstForecastIndex}
              />
            )}
          </CardShell>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Cost by category × month</h2>
            <span className="text-[11px] text-muted-foreground">
              From the Finance Model P&amp;L · toggle to see each line as a share of revenue
            </span>
          </div>
          <MonthMatrixTable
            rows={categoryRows}
            columns={tableColumns}
            primaryLabel="Category"
            secondaryLabel="Group"
            searchPlaceholder="Search category…"
            filterLabel="Group"
            accent="rose"
            shareDenominator={revenueByMonth}
            shareLabel="% of revenue"
          />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Actual transactions</h2>
            <span className="text-[11px] text-muted-foreground">
              Every vendor × category from the ledger · actuals only, no forecast ·
              green is money back
            </span>
          </div>
          <MonthMatrixTable
            rows={allCostRows}
            columns={actualColumns}
            primaryLabel="Vendor / person"
            secondaryLabel="Category"
            searchPlaceholder="Search vendor / person…"
            filterLabel="Category"
            accent="rose"
            shareLabel="% of total"
            signedValues
          />
        </section>

        <LiveFooter sources="Transactions + Finance Model" />
      </div>
    </>
  );
}
