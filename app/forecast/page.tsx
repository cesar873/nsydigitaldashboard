import { BudgetVsActualTable, type BvaRow } from "@/components/tables/BudgetVsActualTable";
import { CardShell } from "@/components/ui/CardShell";
import { EmptyChart } from "@/components/ui/EmptyState";
import { GoalScorecard } from "@/components/ui/GoalScorecard";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { PageHero } from "@/components/layout/PageHero";
import { PlanVsActualChart, type PlanVsActualDatum } from "@/components/charts/PlanVsActualChart";
import { ForecastFiltersBar } from "@/components/layout/ForecastFiltersBar";
import { DriverBoard } from "@/components/ui/DriverBoard";
import { DriverTable } from "@/components/tables/DriverTable";
import { ServiceLineCard, type ServiceLine } from "@/components/ui/ServiceLineCard";
import { SheetError } from "@/components/ui/SheetError";
import { WhatToDoNext } from "@/components/ui/WhatToDoNext";
import { generateWhatToDoNextForecast } from "@/lib/insights/forecast";
import { addMonthsIso, formatMonthLong, formatMonthShort } from "@/lib/months";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  GOALS, computeGoal, goalSeries, yearElapsedFraction, yearMonths,
} from "@/lib/planning";
import { readSummary, rowFor, type IncomeSummary } from "@/lib/sources/income-summary";
import { getLastActualMonth } from "@/lib/sources/stats";
import { getClientRevenue } from "@/lib/sources/client-revenue";
import { buildDrivers, monthElapsedFraction } from "@/lib/targets";
import { listScenarios, resolveScenario } from "@/lib/sources/scenarios";
import { TABS } from "@/lib/config";
import { resolveRange, type SearchParams } from "@/lib/default-range";

export const revalidate = 300;
export const metadata = { title: "Forecast · Finance Dashboard" };

const SERVICE_COLORS = ["#1390eb", "#22c55e", "#c084fc", "#fde047", "#f59e0b"];

function firstParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Discovers service lines from the "<X> Clients" driver rows. */
function serviceLineNames(summary: IncomeSummary): string[] {
  const names: string[] = [];
  for (const row of summary.rows.values()) {
    const m = row.label.match(/^(.*?)\s+Clients$/i);
    if (!m) continue;
    if (/\b(new|lost)\b/i.test(row.label)) continue;
    names.push(m[1].trim());
  }
  return names;
}

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  let actuals: IncomeSummary;
  let scenarios;
  let lastActual: string | null;
  try {
    [actuals, scenarios, lastActual] = await Promise.all([
      readSummary(TABS.financeModel),
      listScenarios(),
      getLastActualMonth(),
    ]);
  } catch (err) {
    return <SheetError error={err} tab="Finance Model" />;
  }

  const scenario = resolveScenario(scenarios, firstParam(sp, "scenario"));
  if (!scenario) {
    return (
      <SheetError
        error={new Error("No scenario tab found. Add a tab named \"Finance Plan\" (or \"Finance Scenario …\") to the sheet.")}
        tab="Finance Plan"
      />
    );
  }

  let plan: IncomeSummary;
  let services;
  try {
    [plan, services] = await Promise.all([readSummary(scenario.tab), getClientRevenue()]);
  } catch (err) {
    return <SheetError error={err} tab={scenario.tab} />;
  }

  const lastActualIso = lastActual ?? [...actuals.actualMonths].sort().at(-1) ?? null;

  // The standard Range control drives the view; it defaults to Jan → Dec of the
  // planning year, and the Budget vs Actual table follows whatever is selected.
  const range = resolveRange({
    searchParams: sp,
    dataMonths: actuals.months,
    lastActualMonthIso: lastActualIso,
  });

  const months = range.rangeMonths;
  if (months.length === 0) {
    return (
      <SheetError
        error={new Error("The Finance Model tab has no month columns in the selected range.")}
        tab="Finance Model"
      />
    );
  }

  // Goals stay scoped to the calendar year so "FY planned" keeps its meaning,
  // regardless of how the range is narrowed.
  const year = Number((lastActualIso ?? months[months.length - 1]).slice(0, 4));
  const fyMonths = yearMonths(actuals, year);
  const fyActualMonths = fyMonths.filter((m) => !lastActualIso || m <= lastActualIso);
  const paceFraction = yearElapsedFraction(year, lastActualIso);

  const actualMonths = months.filter((m) => !lastActualIso || m <= lastActualIso);
  const selectedMonth = range.selectedMonths.at(-1) ?? actualMonths.at(-1) ?? months[0];

  const goals = GOALS.map((def) =>
    computeGoal({
      def,
      actuals,
      plan,
      months: fyMonths,
      actualMonths: fyActualMonths,
      paceFraction,
    }),
  );

  // ---- Scorecard ----
  const scorecardGoals = goals.filter((g) => g.def.key !== "netProfit");

  // "Finance Plan" yields the label "Plan", which would read as "the Plan plan".
  const planName = /^plan$/i.test(scenario.label) ? "the plan" : `the ${scenario.label} plan`;

  const offTrack = scorecardGoals.filter((g) => g.status === "behind");

  // ---- Year charts ----
  /** Cumulative actual vs cumulative plan across the selected range. */
  function cumulativeSeries(label: string): PlanVsActualDatum[] {
    const aRow = rowFor(actuals, label);
    const pRow = rowFor(plan, label);
    let actualCum = 0;
    let planCum = 0;
    return months.map((m) => {
      actualCum += aRow?.byMonth.get(m) ?? 0;
      planCum += pRow?.byMonth.get(m) ?? 0;
      return {
        label: formatMonthShort(m),
        actualCum,
        planCum,
        isActual: !lastActualIso || m <= lastActualIso,
      };
    });
  }

  const revenueSeries = cumulativeSeries("TOTAL REVENUE");

  const revenueRowA = rowFor(actuals, "TOTAL REVENUE");
  const revenueRowP = rowFor(plan, "TOTAL REVENUE");
  const monthMisses = months
    .filter((m) => !lastActualIso || m <= lastActualIso)
    .map((m) => ({
      label: formatMonthShort(m),
      actual: revenueRowA?.byMonth.get(m) ?? 0,
      plan: revenueRowP?.byMonth.get(m) ?? 0,
    }))
    .filter((d) => d.plan !== 0 && d.actual < d.plan);

  // ---- Service lines (TNT style) ----
  const lineNames = serviceLineNames(actuals);
  const serviceLines: ServiceLine[] = lineNames.map((name, i) => {
    const pick = (suffix: string) => ({
      a: rowFor(actuals, `${name} ${suffix}`),
      p: rowFor(plan, `${name} ${suffix}`),
    });
    const clients = pick("Clients");
    const retainer = pick("Retainer");
    const newC = pick("New Clients");
    const lostC = pick("Lost Clients");
    // The revenue row is labelled by the line itself, but the sheet is not
    // consistent: "Meta Clients" → "Meta Ads", "Project Clients" → "Projects".
    const revenueLabel = (s: IncomeSummary) =>
      rowFor(s, `${name} Ads`) ?? rowFor(s, `${name}s`) ?? rowFor(s, name);
    const revA = revenueLabel(actuals);
    const revP = revenueLabel(plan);

    const at = (r: ReturnType<typeof rowFor>) => r?.byMonth.get(selectedMonth) ?? 0;
    const ytd = (r: ReturnType<typeof rowFor>) =>
      actualMonths.reduce((acc, m) => acc + (r?.byMonth.get(m) ?? 0), 0);

    const hasData =
      at(clients.a) !== 0 || at(revA) !== 0 || at(clients.p) !== 0 || at(revP) !== 0;

    return {
      name,
      color: SERVICE_COLORS[i % SERVICE_COLORS.length],
      hasData,
      metrics: [
        { label: "Revenue (mo)", format: "currency" as const, actual: at(revA), plan: at(revP) },
        { label: "Revenue (YTD)", format: "currency" as const, actual: ytd(revA), plan: ytd(revP) },
        { label: "Clients", format: "number" as const, actual: at(clients.a), plan: at(clients.p) },
        { label: "Avg retainer", format: "currency" as const, actual: at(retainer.a), plan: at(retainer.p) },
        { label: "New (YTD)", format: "number" as const, actual: ytd(newC.a), plan: ytd(newC.p) },
        { label: "Lost (YTD)", format: "number" as const, actual: ytd(lostC.a), plan: ytd(lostC.p), inverse: true },
      ],
    };
  });

  // ---- Budget vs Actual ----
  // Laid out as a real P&L: each section heading carries its own TOTAL line, so
  // the headline number reads first and the breakdown sits underneath it.
  const cellsFor = (
    aRow: ReturnType<typeof rowFor>,
    pRow: ReturnType<typeof rowFor>,
  ) =>
    new Map(
      months.map((m) => [
        m,
        {
          budget: pRow?.byMonth.get(m) ?? 0,
          actual: aRow?.byMonth.get(m) ?? 0,
          // Same month a year earlier, for the "vs Last year" view.
          priorActual: aRow?.byMonth.get(addMonthsIso(m, -12)) ?? 0,
          isActual: !lastActualIso || m <= lastActualIso,
        },
      ]),
    );


  function bvaRow(
    label: string,
    kind: BvaRow["kind"],
    sourceLabel: string,
    spacedBefore = false,
  ): BvaRow | null {
    const aRow = rowFor(actuals, sourceLabel);
    const pRow = rowFor(plan, sourceLabel);
    if (!aRow && !pRow) return null;
    return { label, kind, byMonth: cellsFor(aRow, pRow), spacedBefore };
  }

  /** Detail lines inside a P&L section, in sheet order. */
  function detailRows(section: RegExp, stopAt?: string): BvaRow[] {
    const out: BvaRow[] = [];
    for (const key of actuals.order) {
      const row = actuals.rows.get(key);
      if (!row || row.kind !== "detail") continue;
      if (!section.test(row.section)) continue;
      if (/margin/i.test(row.label)) continue;
      if (stopAt && row.label.toLowerCase() === stopAt.toLowerCase()) break;
      const built = bvaRow(row.label, "detail", row.label);
      if (built) out.push(built);
    }
    return out;
  }

  const totalOpexIdx = actuals.order.findIndex((k) =>
    /^total operating expenses$/i.test(actuals.rows.get(k)?.label ?? ""),
  );
  const opexDetails: BvaRow[] = [];
  const otherDetails: BvaRow[] = [];
  actuals.order.forEach((key, idx) => {
    const row = actuals.rows.get(key);
    if (!row || row.kind !== "detail") return;
    if (!/^operating expenses$/i.test(row.section)) return;
    if (/margin/i.test(row.label)) return;
    const built = bvaRow(row.label, "detail", row.label);
    if (!built) return;
    if (totalOpexIdx >= 0 && idx > totalOpexIdx) otherDetails.push(built);
    else opexDetails.push(built);
  });

  const bvaRows: BvaRow[] = [
    bvaRow("Revenue", "section", "TOTAL REVENUE"),
    ...detailRows(/^revenue$/i),

    bvaRow("Cost of sales", "section", "TOTAL COST OF SALES", true),
    ...detailRows(/^cost of sales$/i),

    bvaRow("Gross profit", "total", "GROSS PROFIT", true),
    bvaRow("Gross margin", "margin", "Gross Profit Margin"),

    bvaRow("Operating expenses", "section", "TOTAL OPERATING EXPENSES", true),
    ...opexDetails,

    bvaRow("Operating profit", "total", "OPERATING PROFIT", true),
    bvaRow("Operating margin", "margin", "Operating Profit Margin"),

    ...(otherDetails.length > 0
      ? [
          {
            label: "Other expenses",
            kind: "section" as const,
            byMonth: new Map(
              months.map((m) => [
                m,
                {
                  budget: otherDetails.reduce((a, r) => a + (r.byMonth.get(m)?.budget ?? 0), 0),
                  actual: otherDetails.reduce((a, r) => a + (r.byMonth.get(m)?.actual ?? 0), 0),
                  priorActual: otherDetails.reduce(
                    (a, r) => a + (r.byMonth.get(m)?.priorActual ?? 0),
                    0,
                  ),
                  isActual: !lastActualIso || m <= lastActualIso,
                },
              ]),
            ),
            spacedBefore: true,
          },
          ...otherDetails,
        ]
      : []),

    bvaRow("Net profit", "total", "NET PROFIT", true),
    bvaRow("Net margin", "margin", "Net Profit Margin"),
  ].filter((r): r is BvaRow => r !== null);

  const insights = generateWhatToDoNextForecast({
    goals,
    scenarioLabel: scenario.label,
    year,
    paceFraction,
    monthLabel: formatMonthLong(selectedMonth),
    monthMisses,
    elapsedMonths: fyActualMonths.length,
    duplicateLabels: plan.duplicateLabels,
  });

  const rangeLabel = `${formatMonthShort(months[0])} → ${formatMonthShort(months[months.length - 1])}`;

  // ---- Operating drivers ----
  // Targets come from the scenario; actuals are live off the Services roster, so
  // signing or losing a client today moves these today.
  const today = new Date();
  const currentMonthIso = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const drivers = buildDrivers({
    plan,
    actuals,
    services,
    months: fyMonths,
    currentMonthIso,
  });
  const elapsed = monthElapsedFraction(currentMonthIso, today);

  return (
    <>
      <ForecastFiltersBar
        scenarios={scenarios}
        selectedScenario={scenario.tab}
        allMonths={actuals.months}
        selectedMonths={range.selectedMonths}
        fromIso={range.fromIso}
        toIso={range.toIso}
        minIso={range.minIso}
        maxIso={range.maxIso}
        lastActualMonthIso={lastActualIso}
      />

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Plan vs actual"
          title="Forecast"
          period={`${rangeLabel} · scenario ${scenario.label}`}
          source={`Finance Model vs ${scenario.tab}`}
        />

        <WhatToDoNext periodLabel={`FY ${year} · ${scenario.label}`} insights={insights} />

        <div className="mb-2">
          <h2 className="text-base font-semibold">Scorecard · FY {year}</h2>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {scorecardGoals.map((g) => (
            <GoalScorecard key={g.def.key} goal={g} />
          ))}
        </section>

        <section className="mt-8">
          <CardShell
            title="Revenue — plan vs actual"
            subtitle={`Cumulative across ${rangeLabel} · blue is actual, dashed green is ${planName}`}
            right={
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {revenueSeries.length > 0 &&
                  (() => {
                    const atLast = revenueSeries[actualMonths.length - 1];
                    if (!atLast) return null;
                    const gap = atLast.actualCum - atLast.planCum;
                    return (
                      <>
                        {gap > 0 ? "YTD ahead by " : gap < 0 ? "YTD behind by " : "YTD on plan"}
                        <span
                          className={
                            gap > 0
                              ? "font-semibold text-emerald-300"
                              : gap < 0
                                ? "font-semibold text-rose-300"
                                : "text-muted-foreground"
                          }
                        >
                          {gap === 0
                            ? ""
                            : formatCurrency(Math.abs(gap), { compact: true })}
                        </span>
                      </>
                    );
                  })()}
              </span>
            }
          >
            {revenueSeries.length === 0 ? (
              <EmptyChart message="No months in the selected range." />
            ) : (
              <PlanVsActualChart data={revenueSeries} height={380} />
            )}
          </CardShell>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Key targets · FY {year}</h2>
          </div>
          <DriverBoard
            drivers={drivers.filter((d) => d.onBoard)}
            months={fyMonths}
            currentMonthIso={currentMonthIso}
            elapsed={elapsed}
          />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Targets by month</h2>
            <span className="text-[11px] text-muted-foreground">
              Actual against target each month · bar fills to target, overshoot means ahead
            </span>
          </div>
          <DriverTable drivers={drivers} months={fyMonths} currentMonthIso={currentMonthIso} />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Service line vs scenario</h2>
            <span className="text-[11px] text-muted-foreground">
              {formatMonthShort(selectedMonth)} snapshot · badge is variance vs {scenario.label}
            </span>
          </div>
          {serviceLines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              No per-service driver rows found in the Finance Model tab.
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(serviceLines.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {serviceLines.map((line) => (
                <ServiceLineCard key={line.name} line={line} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Budget vs Actual</h2>
            <span className="text-[11px] text-muted-foreground">
              Every P&amp;L line from {scenario.tab} · ordered Revenue → COGS → Expenses
            </span>
          </div>
          <BudgetVsActualTable
            rows={bvaRows}
            months={months}
            monthLabels={months.map(formatMonthShort)}
          />
        </section>

        <LiveFooter sources={`Finance Model + ${scenario.tab} + Legend`} />
      </div>
    </>
  );
}
