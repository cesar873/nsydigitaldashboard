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
import { currencyFrom } from "@/lib/currency";
import { formatMonthShort, periodLabel } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { generateWhatToDoNextExpensesFromModel } from "@/lib/insights/expenses";
import { getIncomeSummary, seriesFor, sumMonths } from "@/lib/sources/income-summary";
import { getLastActualMonth } from "@/lib/sources/stats";
import { expenseCategories } from "@/lib/sources/expense-categories";
import { expenseRows, getTransactions, type Transaction } from "@/lib/sources/transactions";

export const revalidate = 300;
export const metadata = { title: "Expenses · Finance Dashboard" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currency = currencyFrom(sp);

  // The page is driven by the Finance Model P&L, so its cost figures always tie
  // to the statement. The raw Transactions ledger is optional — it only powers
  // the vendor-level detail table, and only when it carries classified expense
  // rows (an Account Type column). A Xero-style bank export without that column
  // simply hides that one section rather than breaking the page.
  let summary, lastActual;
  try {
    [summary, lastActual] = await Promise.all([
      getIncomeSummary(),
      getLastActualMonth(),
    ]);
  } catch (err) {
    return <SheetError error={err} tab="Finance Model" />;
  }

  const modelCategories = expenseCategories(summary);
  if (modelCategories.length === 0) {
    return (
      <SheetError
        error={
          new Error(
            "No cost lines found in the Finance Model P&L (Cost of Sales / Operating Expenses).",
          )
        }
        tab="Finance Model"
      />
    );
  }

  // Optional ledger detail. Never fatal to the page.
  let ledgerRows: Transaction[] = [];
  try {
    ledgerRows = expenseRows(await getTransactions());
  } catch {
    ledgerRows = [];
  }
  const hasLedgerDetail = ledgerRows.length > 0;

  const txMonths = [
    ...new Set(ledgerRows.map((r) => r.monthIso).filter((m): m is string => !!m)),
  ];
  // The range spans the Finance Model's months (which include forecast), unioned
  // with any ledger months so nothing is truncated.
  const dataMonths = [...new Set([...summary.months, ...txMonths])].sort();

  const range = resolveRange({
    searchParams: sp,
    dataMonths,
    lastActualMonthIso: lastActual,
  });

  const revenueSeries = seriesFor(summary, /^total revenue$/i);
  const revenue = sumMonths(revenueSeries, range.selectedMonths);

  // ── Totals, straight from the Finance Model cost lines ──────────────────────
  const sumCats = (cats: typeof modelCategories, months: string[]) =>
    cats.reduce(
      (acc, c) => acc + months.reduce((s, m) => s + (c.byMonth.get(m) ?? 0), 0),
      0,
    );

  const cur = sumCats(modelCategories, range.selectedMonths);
  const hasPrior = range.priorMonths.every((m) => dataMonths.includes(m));
  const prior = hasPrior ? sumCats(modelCategories, range.priorMonths) : 0;
  const priorLabel = hasPrior ? periodLabel(range.priorMonths) : "no prior period";
  const deltaLabel = hasPrior ? `vs ${priorLabel}` : "no prior period";

  const cogsCats = modelCategories.filter((c) => c.group === "Cost of sales");
  const opexCats = modelCategories.filter((c) => c.group !== "Cost of sales");
  const cogsCur = sumCats(cogsCats, range.selectedMonths);
  const opexCur = sumCats(opexCats, range.selectedMonths);

  // Stacked bars + category table read the Finance Model, so forecast months are
  // populated (the ledger only ever holds actuals).
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

  // ── Optional: vendor × category detail from the classified ledger ───────────
  const vendorMap = new Map<
    string,
    { vendor: string; category: string; byMonth: Map<string, number> }
  >();
  if (hasLedgerDetail) {
    for (const t of ledgerRows) {
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
  }
  const allCostRows: MatrixRow[] = [...vendorMap.entries()].map(([key, v]) => ({
    key,
    primary: v.vendor,
    secondary: v.category,
    byMonth: v.byMonth,
  }));
  const actualColumns = tableColumns.filter((c) => !c.isForecast);

  const costRatio = revenue > 0 ? cur / revenue : null;
  const ratioTone: Tone =
    costRatio === null ? "neutral" : costRatio <= 0.5 ? "success" : costRatio <= 0.7 ? "warning" : "danger";

  const delta = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));

  const sources = hasLedgerDetail ? "Transactions + Finance Model" : "Finance Model";

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
          source={sources}
        />

        <WhatToDoNext
          periodLabel={range.periodLabel}
          insights={generateWhatToDoNextExpensesFromModel(
            modelCategories,
            range.selectedMonths,
            hasPrior ? range.priorMonths : [],
            priorLabel,
            revenue,
            currency,
          )}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Expenses"
            value={formatCurrency(cur, { compact: true, currency })}
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
            label="Cost of Sales"
            value={formatCurrency(cogsCur, { compact: true, currency })}
          />
          <KpiStat
            label="Operating Expenses"
            value={formatCurrency(opexCur, { compact: true, currency })}
          />
          <KpiStat label="Categories" value={String(modelCategories.length)} />
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
                currency={currency}
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
            currency={currency}
            primaryLabel="Category"
            secondaryLabel="Group"
            searchPlaceholder="Search category…"
            filterLabel="Group"
            accent="rose"
            shareDenominator={revenueByMonth}
            shareLabel="% of revenue"
          />
        </section>

        {hasLedgerDetail && (
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
              currency={currency}
              primaryLabel="Vendor / person"
              secondaryLabel="Category"
              searchPlaceholder="Search vendor / person…"
              filterLabel="Category"
              accent="rose"
              shareLabel="% of total"
              signedValues
            />
          </section>
        )}

        <LiveFooter sources={sources} />
      </div>
    </>
  );
}
