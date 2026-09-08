import { CardShell } from "@/components/ui/CardShell";
import { EmptyChart } from "@/components/ui/EmptyState";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { SingleBarChart } from "@/components/charts/SingleBarChart";
import { YearComparisonCard, type YearComparison } from "@/components/ui/YearComparisonCard";
import { YearOverYearChart, type YoyMetric } from "@/components/charts/YearOverYearChart";
import { TransactionTable, type TxRow } from "@/components/tables/TransactionTable";
import { getTransactions } from "@/lib/sources/transactions";
import { PageHero } from "@/components/layout/PageHero";
import { WhatToDoNext } from "@/components/ui/WhatToDoNext";
import { SheetError } from "@/components/ui/SheetError";
import { resolveRange, type SearchParams } from "@/lib/default-range";
import { formatMonthShort, periodLabel } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  generateWhatToDoNextFinancials,
  type FinancialsTotals,
} from "@/lib/insights/financials";
import {
  getIncomeSummary, seriesFor, sumMonths, type IncomeSummary,
} from "@/lib/sources/income-summary";
import { getLastActualMonth } from "@/lib/sources/stats";

export const revalidate = 300;
export const metadata = { title: "Financials · Finance Dashboard" };

const ROW = {
  revenue: /^total revenue$/i,
  cogs: /^total cost of sales$/i,
  grossProfit: /^gross profit$/i,
  grossMargin: /^gross margin$/i,
  opex: /^total operating expenses$/i,
  operatingProfit: /^operating profit$/i,
  operatingMargin: /^operating margin$/i,
  netProfit: /^net profit$/i,
  netMargin: /^net profit margin$/i,
  endingCash: /^total cash$/i,
  ownerPay: /^owner$/i,
  receivables: /^accounts receivable$/i,
  creditCard: /^credit card payable$/i,
};

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let summary: IncomeSummary;
  let lastActual: string | null;
  let ledger;
  try {
    [summary, lastActual, ledger] = await Promise.all([
      getIncomeSummary(),
      getLastActualMonth(),
      getTransactions(),
    ]);
  } catch (err) {
    return <SheetError error={err} tab="Finance Model" />;
  }

  if (summary.months.length === 0) {
    return <SheetError error={new Error("No month columns found in the Finance Model tab. Check the tab name in lib/config.ts.")} tab="Finance Model" />;
  }

  // Fall back to the sheet's own Status row when the Stats tab is unavailable.
  const actualsFromStatus = [...summary.actualMonths].sort().at(-1) ?? null;
  const range = resolveRange({
    searchParams: sp,
    dataMonths: summary.months,
    lastActualMonthIso: lastActual ?? actualsFromStatus,
  });

  const s = {
    revenue: seriesFor(summary, ROW.revenue),
    cogs: seriesFor(summary, ROW.cogs),
    grossProfit: seriesFor(summary, ROW.grossProfit),
    grossMargin: seriesFor(summary, ROW.grossMargin),
    opex: seriesFor(summary, ROW.opex),
    operatingProfit: seriesFor(summary, ROW.operatingProfit),
    operatingMargin: seriesFor(summary, ROW.operatingMargin),
    netProfit: seriesFor(summary, ROW.netProfit),
    netMargin: seriesFor(summary, ROW.netMargin),
    endingCash: seriesFor(summary, ROW.endingCash),
    ownerPay: seriesFor(summary, ROW.ownerPay),
    receivables: seriesFor(summary, ROW.receivables),
    creditCard: seriesFor(summary, ROW.creditCard),
  };

  function totals(months: string[]): FinancialsTotals {
    const revenue = sumMonths(s.revenue, months);
    const cogs = sumMonths(s.cogs, months);
    const opex = sumMonths(s.opex, months);
    // Derive when the sheet doesn't carry the row (tabs.md Tab 1 inputs).
    const grossProfit = s.grossProfit ? sumMonths(s.grossProfit, months) : revenue - cogs;
    const operatingProfit = s.operatingProfit
      ? sumMonths(s.operatingProfit, months)
      : grossProfit - opex;
    const netProfit = s.netProfit ? sumMonths(s.netProfit, months) : null;

    // Margins are ratios, so they're recomputed from period totals rather than
    // averaged across months.
    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin: revenue !== 0 ? grossProfit / revenue : null,
      opex,
      operatingProfit,
      operatingMargin: revenue !== 0 ? operatingProfit / revenue : null,
      netProfit,
      netMargin: netProfit !== null && revenue !== 0 ? netProfit / revenue : null,
      // Cash is a balance, not a flow — take the last month, never a sum.
      endingCash: s.endingCash ? (s.endingCash.get(months.at(-1) ?? "") ?? null) : null,
    };
  }

  const cur = totals(range.selectedMonths);
  const hasPrior = range.priorMonths.every((m) => summary.months.includes(m));
  const prior = hasPrior ? totals(range.priorMonths) : null;
  const priorLabel = hasPrior ? periodLabel(range.priorMonths) : "no prior period";
  const deltaLabel = hasPrior ? `vs ${priorLabel}` : "no prior period";

  const delta = (a: number, b: number | undefined) =>
    b === undefined || b === 0 ? null : (a - b) / Math.abs(b);

  const trend = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    revenue: s.revenue?.get(m) ?? 0,
    operatingProfit: s.operatingProfit?.get(m) ?? 0,
  }));

  const marginTrend = range.rangeMonths.map((m) => {
    const rev = s.revenue?.get(m) ?? 0;
    const gp = s.grossProfit?.get(m) ?? rev - (s.cogs?.get(m) ?? 0);
    const op = s.operatingProfit?.get(m) ?? gp - (s.opex?.get(m) ?? 0);
    return {
      label: formatMonthShort(m),
      grossMargin: s.grossMargin?.get(m) ?? (rev !== 0 ? gp / rev : 0),
      operatingMargin: s.operatingMargin?.get(m) ?? (rev !== 0 ? op / rev : 0),
    };
  });

  const isForecast = (m: string) =>
    !!range.lastActualMonthIso && m > range.lastActualMonthIso;

  const cashBars = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    value: s.endingCash?.get(m) ?? 0,
    isForecast: isForecast(m),
  }));

  const ownerBars = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    value: s.ownerPay?.get(m) ?? 0,
    isForecast: isForecast(m),
  }));

  const receivableBars = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    value: s.receivables?.get(m) ?? 0,
    isForecast: isForecast(m),
  }));

  const creditCardBars = range.rangeMonths.map((m) => ({
    label: formatMonthShort(m),
    value: s.creditCard?.get(m) ?? 0,
    isForecast: isForecast(m),
  }));

  // ---- Year over year: last three years, YTD and full year ----
  const lastActualIso = range.lastActualMonthIso;
  const currentYear = Number((lastActualIso ?? summary.months.at(-1) ?? "2026-01-01").slice(0, 4));
  // How many months of the current year are actual — the like-for-like window.
  const elapsedMonthCount = lastActualIso ? Number(lastActualIso.slice(5, 7)) : 12;

  const yearsAvailable = [...new Set(summary.months.map((m) => Number(m.slice(0, 4))))].sort();
  const comparisonYears = yearsAvailable
    .filter((y) => y <= currentYear)
    .slice(-3);

  function monthsOfYear(year: number, limit?: number) {
    return summary.months
      .filter((m) => m.startsWith(String(year)))
      .sort()
      .filter((m) => (limit ? Number(m.slice(5, 7)) <= limit : true));
  }

  function statsFor(year: number): YearComparison {
    const ytdMonths = monthsOfYear(year, elapsedMonthCount);
    const fyMonths = monthsOfYear(year);

    const agg = (months: string[]) => {
      if (months.length === 0) return null;
      const revenue = sumMonths(s.revenue, months);
      const cogs = sumMonths(s.cogs, months);
      const opex = sumMonths(s.opex, months);
      const gp = s.grossProfit ? sumMonths(s.grossProfit, months) : revenue - cogs;
      const op = s.operatingProfit ? sumMonths(s.operatingProfit, months) : gp - opex;
      const np = s.netProfit ? sumMonths(s.netProfit, months) : null;
      return {
        revenue,
        grossMargin: revenue !== 0 ? gp / revenue : null,
        operatingMargin: revenue !== 0 ? op / revenue : null,
        netProfit: np,
        // Cash is a balance: take the last month of the window, never a sum.
        cash: s.endingCash ? (s.endingCash.get(months[months.length - 1]) ?? null) : null,
        owner: sumMonths(s.ownerPay, months),
      };
    };

    const ytd = agg(ytdMonths);
    const fy = agg(fyMonths);

    return {
      year,
      isCurrent: year === currentYear,
      ytdLabel: `YTD ${elapsedMonthCount}M`,
      stats: [
        { label: "Revenue", format: "currency", ytd: ytd?.revenue ?? null, fy: fy?.revenue ?? null },
        { label: "Gross margin", format: "percent", ytd: ytd?.grossMargin ?? null, fy: fy?.grossMargin ?? null },
        { label: "Operating margin", format: "percent", ytd: ytd?.operatingMargin ?? null, fy: fy?.operatingMargin ?? null },
        { label: "Net profit", format: "currency", ytd: ytd?.netProfit ?? null, fy: fy?.netProfit ?? null },
        { label: "Owner pay", format: "currency", ytd: ytd?.owner ?? null, fy: fy?.owner ?? null },
        { label: "Ending cash", format: "currency", ytd: ytd?.cash ?? null, fy: fy?.cash ?? null },
      ],
    };
  }

  const yearCards = comparisonYears.map(statsFor);

  // ---- Year-over-year chart: any metric, every year on one Jan–Dec axis ----
  function yoy(
    label: string,
    format: "currency" | "percent",
    pick: (monthIso: string) => number | null,
  ): YoyMetric {
    const byYear: Record<string, (number | null)[]> = {};
    for (const y of comparisonYears) {
      byYear[String(y)] = Array.from({ length: 12 }, (_, i) => {
        const m = `${y}-${String(i + 1).padStart(2, "0")}-01`;
        if (!summary.months.includes(m)) return null;
        // Nothing has happened past the last actual month.
        if (lastActualIso && m > lastActualIso) return null;
        return pick(m);
      });
    }
    return { key: label, label, format, byYear };
  }

  const monthlyMargin = (numerator: (m: string) => number) => (m: string) => {
    const rev = s.revenue?.get(m) ?? 0;
    return rev === 0 ? null : numerator(m) / rev;
  };

  const yoyMetrics: YoyMetric[] = [
    yoy("Revenue", "currency", (m) => s.revenue?.get(m) ?? null),
    yoy("Gross profit", "currency", (m) =>
      s.grossProfit?.get(m) ?? (s.revenue?.get(m) ?? 0) - (s.cogs?.get(m) ?? 0),
    ),
    yoy("Gross margin", "percent", monthlyMargin(
      (m) => s.grossProfit?.get(m) ?? (s.revenue?.get(m) ?? 0) - (s.cogs?.get(m) ?? 0),
    )),
    yoy("Operating profit", "currency", (m) => s.operatingProfit?.get(m) ?? null),
    yoy("Operating margin", "percent", monthlyMargin((m) => s.operatingProfit?.get(m) ?? 0)),
    yoy("Net profit", "currency", (m) => s.netProfit?.get(m) ?? null),
    yoy("Operating expenses", "currency", (m) => s.opex?.get(m) ?? null),
    yoy("Owner pay", "currency", (m) => s.ownerPay?.get(m) ?? null),
    yoy("Ending cash", "currency", (m) => s.endingCash?.get(m) ?? null),
  ];

  // ---- Full ledger, for the table at the foot of the page ----
  const txRows: TxRow[] = ledger.rows.map((t) => ({
    date: t.rawDate,
    monthIso: t.monthIso,
    type: t.accountType,
    contact: t.contact,
    description: t.description,
    category: t.summaryCategory || t.account,
    account: t.account,
    amount: t.net,
  }));

  const marginTone = (v: number | null, hi: number, mid: number): Tone =>
    v === null ? "neutral" : v >= hi ? "success" : v >= mid ? "warning" : "danger";

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
          eyebrow="Financial overview"
          title="Financials"
          period={range.periodLabel}
          source="Finance Model"
        />

        <WhatToDoNext
          periodLabel={range.periodLabel}
          insights={generateWhatToDoNextFinancials(cur, prior, priorLabel)}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Revenue"
            value={formatCurrency(cur.revenue, { compact: true })}
            delta={delta(cur.revenue, prior?.revenue)}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Gross Profit"
            value={formatCurrency(cur.grossProfit, { compact: true })}
            tone={cur.grossProfit < 0 ? "danger" : cur.grossProfit > 0 ? "success" : "neutral"}
            delta={delta(cur.grossProfit, prior?.grossProfit)}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Operating Profit"
            value={formatCurrency(cur.operatingProfit, { compact: true })}
            tone={
              cur.operatingProfit < 0 ? "danger" : cur.operatingProfit > 0 ? "success" : "neutral"
            }
            delta={delta(cur.operatingProfit, prior?.operatingProfit)}
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Gross Margin"
            value={cur.grossMargin === null ? "—" : formatPercent(cur.grossMargin)}
            tone={marginTone(cur.grossMargin, 0.5, 0.3)}
            delta={
              cur.grossMargin !== null && prior?.grossMargin
                ? cur.grossMargin - prior.grossMargin
                : null
            }
            deltaLabel={deltaLabel}
          />
          <KpiStat
            label="Operating Margin"
            value={cur.operatingMargin === null ? "—" : formatPercent(cur.operatingMargin)}
            tone={marginTone(cur.operatingMargin, 0.15, 0.05)}
            delta={
              cur.operatingMargin !== null && prior?.operatingMargin
                ? cur.operatingMargin - prior.operatingMargin
                : null
            }
            deltaLabel={deltaLabel}
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Revenue & Operating Profit by month"
            subtitle="Same axis — visual gap shows how much profit lags revenue"
          >
            {trend.length === 0 ? (
              <EmptyChart message="No months in the selected range." />
            ) : (
              <MultiLineChart
                data={trend}
                leftFormat="currency"
                firstForecastIndex={range.firstForecastIndex}
                series={[
                  {
                    key: "revenue",
                    name: "Revenue",
                    color: "#1390eb",
                    format: "currency",
                    labelPosition: "top",
                  },
                  {
                    key: "operatingProfit",
                    name: "Operating Profit",
                    color: "#22c55e",
                    format: "currency",
                    labelPosition: "bottom",
                  },
                ]}
              />
            )}
          </CardShell>
        </section>

        <section className="mt-6">
          <CardShell title="Gross & Operating Margin" subtitle="Two-line margin trend">
            {marginTrend.length === 0 ? (
              <EmptyChart message="No months in the selected range." />
            ) : (
              <MultiLineChart
                data={marginTrend}
                leftFormat="percent"
                firstForecastIndex={range.firstForecastIndex}
                series={[
                  {
                    key: "grossMargin",
                    name: "Gross Margin",
                    color: "#1390eb",
                    format: "percent",
                  },
                  {
                    key: "operatingMargin",
                    name: "Operating Margin",
                    color: "#22c55e",
                    format: "percent",
                  },
                ]}
              />
            )}
          </CardShell>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardShell
            title="Cash by month"
            subtitle="Ending cash balance · lighter months are forecast"
            className="flex h-full flex-col"
          >
            {cashBars.every((b) => b.value === 0) ? (
              <EmptyChart height={260} message="No cash balances in the selected range." />
            ) : (
              <SingleBarChart data={cashBars} color="#22c55e" name="Ending cash" height={260} />
            )}
          </CardShell>

          <CardShell
            title="Accounts receivable"
            subtitle="Invoiced but not yet collected"
            className="flex h-full flex-col"
          >
            {receivableBars.every((b) => b.value === 0) ? (
              <EmptyChart
                height={260}
                message="Accounts Receivable is empty in the Finance Model."
              />
            ) : (
              <SingleBarChart data={receivableBars} color="#c084fc" name="Receivables" height={260} />
            )}
          </CardShell>

          <CardShell
            title="Credit card payable"
            subtitle="Short-term liability · more liability lines can join this chart"
            className="flex h-full flex-col"
          >
            {creditCardBars.every((b) => b.value === 0) ? (
              <EmptyChart
                height={260}
                message="Credit Card Payable is empty in the Finance Model."
              />
            ) : (
              <SingleBarChart data={creditCardBars} color="#f59e0b" name="Credit card" height={260} />
            )}
          </CardShell>

          <CardShell
            title="Owner pay by month"
            subtitle="The Owner line from the Finance Model · lighter months are forecast"
            className="flex h-full flex-col"
          >
            {ownerBars.every((b) => b.value === 0) ? (
              <EmptyChart height={260} message="No owner pay in the selected range." />
            ) : (
              <SingleBarChart data={ownerBars} color="#1390eb" name="Owner pay" height={260} />
            )}
          </CardShell>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Year over year</h2>
            <span className="text-[11px] text-muted-foreground">
              Left column is the same {elapsedMonthCount}-month window in every year ·
              right column is the full year, or this year&apos;s run rate
            </span>
          </div>
          {yearCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              Not enough history in the sheet for a year-over-year view.
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(yearCards.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {yearCards.map((y) => (
                <YearComparisonCard key={y.year} data={y} />
              ))}
            </div>
          )}

          {yearCards.length > 0 && (
            <div className="mt-3 rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
              <YearOverYearChart metrics={yoyMetrics} years={comparisonYears} />
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">All transactions</h2>
            <span className="text-[11px] text-muted-foreground">
              Every ledger line · filter by type, category, contact or account
            </span>
          </div>
          <TransactionTable rows={txRows} />
        </section>

        <LiveFooter sources="Finance Model + Transactions" />
      </div>
    </>
  );
}
