import { CardShell } from "@/components/ui/CardShell";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { PageHero } from "@/components/layout/PageHero";
import { PeopleProfitTable } from "@/components/tables/PeopleProfitTable";
import { SheetError } from "@/components/ui/SheetError";
import { VerticalBarChart } from "@/components/charts/VerticalBarChart";
import { WhatToDoNext, type Insight } from "@/components/ui/WhatToDoNext";
import { formatMonthShort } from "@/lib/months";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getTeamProfit, type TeamProfitRow } from "@/lib/sources/team-profit";
import type { SearchParams } from "@/lib/default-range";
import { currencyFrom, GBP_VIEW, type CurrencyView } from "@/lib/currency";

export const revalidate = 300;
export const metadata = { title: "People · Finance Dashboard" };

/** Only people with a utilisation target are held to one. */
function billable(rows: TeamProfitRow[]) {
  return rows.filter((r) => r.utilizationTarget !== null && r.utilizationTarget > 0);
}

function buildInsights(rows: TeamProfitRow[], currency: CurrencyView = GBP_VIEW): Insight[] {
  const out: Insight[] = [];
  const withTarget = billable(rows).filter((r) => r.utilizationActual !== null);

  const under = withTarget
    .map((r) => ({ r, pp: (r.utilizationActual! - r.utilizationTarget!) * 100 }))
    .filter((x) => x.pp <= -30)
    .sort((a, b) => a.pp - b.pp);

  if (under.length > 0) {
    const unrealised = under.reduce((a, x) => a + Math.max(0, x.r.revenueGap), 0);
    out.push({
      tone: "alert",
      prose:
        under.length === 1
          ? `<b>${under[0].r.name}</b> is <b>${Math.abs(under[0].pp).toFixed(0)} pp</b> below target — about ${formatCurrency(Math.max(0, under[0].r.revenueGap), { compact: true, currency })} of capacity unused.`
          : `<b>${under.length} team members</b> sit 30+ pp below target (<b>${formatCurrency(unrealised, { compact: true, currency })}</b> unrealised). Worst: <b>${under[0].r.name}</b> at ${under[0].pp.toFixed(0)} pp.`,
    });
  }

  const over = withTarget
    .map((r) => ({ r, pp: (r.utilizationActual! - r.utilizationTarget!) * 100 }))
    .filter((x) => x.r.utilizationActual! > 1.1)
    .sort((a, b) => b.pp - a.pp);
  if (over.length > 0) {
    out.push({
      tone: "warn",
      prose: `<b>${over[0].r.name}</b> is running at <b>${formatPercent(over[0].r.utilizationActual!, 0)}</b> (+${over[0].pp.toFixed(0)} pp over target). Burnout risk — redistribute or hire.`,
    });
  }

  const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
  if (best && best.profit > 0) {
    out.push({
      tone: "win",
      prose: `<b>${best.name}</b>${best.department ? ` (${best.department})` : ""} covered <b>${formatCurrency(best.revenueCovered, { compact: true, currency })}</b>, returning ${formatCurrency(best.profit, { compact: true, currency })} over cost.`,
    });
  }

  const loss = rows.filter((r) => r.profit < 0);
  if (loss.length > 0) {
    const total = loss.reduce((a, r) => a + r.profit, 0);
    out.push({
      tone: "info",
      prose: `<b>${loss.length}</b> ${loss.length === 1 ? "person costs" : "people cost"} more than they cover (<b>${formatCurrency(Math.abs(total), { compact: true, currency })}</b>). Expected for non-billable roles — worth checking the split is deliberate.`,
    });
  }

  return out;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currency = currencyFrom(sp);

  let rows: TeamProfitRow[];
  try {
    rows = await getTeamProfit();
  } catch (err) {
    return <SheetError error={err} tab="Team Profit" />;
  }

  if (rows.length === 0) {
    return (
      <SheetError
        error={new Error("The Team Profit tab has no rows yet. It fills in when a month is closed and appended.")}
        tab="Team Profit"
      />
    );
  }

  const monthsPresent = [...new Set(rows.map((r) => r.monthIso).filter((m): m is string => !!m))].sort();
  const latest = monthsPresent[monthsPresent.length - 1] ?? null;
  const periodLabel = latest ? formatMonthShort(latest) : (rows[0]?.monthLabel ?? "All data");

  const revenueCovered = rows.reduce((a, r) => a + r.revenueCovered, 0);
  const billableRows = billable(rows).filter((r) => r.utilizationActual !== null);
  const avgUtilization =
    billableRows.length > 0
      ? billableRows.reduce((a, r) => a + (r.utilizationActual ?? 0), 0) / billableRows.length
      : null;
  const onTarget = billableRows.filter(
    (r) => (r.utilizationActual ?? 0) >= (r.utilizationTarget ?? 0),
  ).length;
  const revenueGap = rows.reduce((a, r) => a + Math.max(0, r.revenueGap), 0);
  const hoursBillable = rows.reduce((a, r) => a + r.hoursAvailable, 0);

  /** Averages and totals per department. */
  function byDepartment(pick: (r: TeamProfitRow) => number | null, mode: "avg" | "sum") {
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const v = pick(r);
      if (v === null) continue;
      const d = r.department || "Unassigned";
      groups.set(d, [...(groups.get(d) ?? []), v]);
    }
    return [...groups.entries()]
      .map(([name, vs]) => ({
        name,
        value: mode === "avg" ? vs.reduce((a, b) => a + b, 0) / vs.length : vs.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.value - a.value);
  }

  const utilByDept = byDepartment(
    (r) => (r.utilizationTarget && r.utilizationTarget > 0 ? r.utilizationActual : null),
    "avg",
  );
  const hoursByDept = byDepartment((r) => r.hoursAvailable, "sum");

  const utilTone: Tone =
    avgUtilization === null
      ? "neutral"
      : avgUtilization >= 0.75
        ? "success"
        : avgUtilization >= 0.5
          ? "warning"
          : "danger";

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
      <PageHero
        eyebrow="Team profitability"
        title="People"
        period={periodLabel}
        source="Team Profit"
      />

      <WhatToDoNext periodLabel={periodLabel} insights={buildInsights(rows, currency)} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat label="Revenue Covered" value={formatCurrency(revenueCovered, { compact: true, currency })} />
        <KpiStat
          label="Avg Utilization"
          value={avgUtilization === null ? "—" : formatPercent(avgUtilization)}
          tone={utilTone}
          deltaLabel="billable roles only"
        />
        <KpiStat
          label="People on Target"
          value={`${onTarget}/${billableRows.length}`}
          tone={onTarget === billableRows.length ? "success" : "warning"}
        />
        <KpiStat
          label="Revenue Gap"
          value={formatCurrency(revenueGap, { compact: true, currency })}
          tone={revenueGap === 0 ? "success" : "danger"}
          deltaLabel="under-target capacity"
        />
        <KpiStat
          label="Hours Billable"
          value={formatNumber(hoursBillable)}
          deltaLabel="across the period"
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardShell
          title="Average utilization by department"
          subtitle={`Across ${periodLabel} · billable departments only`}
          className="flex h-full flex-col"
        >
          <VerticalBarChart data={utilByDept} format="percent" color="#22c55e" />
        </CardShell>
        <CardShell
          title="Hours available by department"
          subtitle={`Total hours across ${periodLabel}`}
          className="flex h-full flex-col"
        >
          <VerticalBarChart data={hoursByDept} format="number" color="#1390eb" />
        </CardShell>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold">People profitability</h2>
          <span className="text-[11px] text-muted-foreground">
            One row per person · default sort by revenue covered
          </span>
        </div>
        <PeopleProfitTable rows={rows} currency={currency} />
      </section>

      <LiveFooter sources="Team Profit" />
    </div>
  );
}
