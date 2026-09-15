import { CardShell } from "@/components/ui/CardShell";
import { ClientProfitTable } from "@/components/tables/ClientProfitTable";
import { EmptyChart } from "@/components/ui/EmptyState";
import { KpiStat, type Tone } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { PageHero } from "@/components/layout/PageHero";
import { SheetError } from "@/components/ui/SheetError";
import { VerticalBarChart } from "@/components/charts/VerticalBarChart";
import { WhatToDoNext, type Insight } from "@/components/ui/WhatToDoNext";
import { formatMonthShort } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getClientProfit, type ClientProfitRow } from "@/lib/sources/client-profit";
import type { SearchParams } from "@/lib/default-range";
import { currencyFrom, GBP_VIEW, type CurrencyView } from "@/lib/currency";

export const revalidate = 300;
export const metadata = { title: "Clients · Finance Dashboard" };

/** Margin of a group of rows: total profit over total revenue. */
function marginOf(rows: ClientProfitRow[]): number | null {
  const revenue = rows.reduce((a, r) => a + r.revenue, 0);
  if (revenue === 0) return null;
  return rows.reduce((a, r) => a + r.profit, 0) / revenue;
}

function groupMargins(rows: ClientProfitRow[], key: "service" | "intensity") {
  const groups = new Map<string, ClientProfitRow[]>();
  for (const r of rows) {
    const g = r[key] || "Unspecified";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([name, rs]) => ({ name, value: marginOf(rs) ?? 0 }))
    .filter((d) => d.value !== 0)
    .sort((a, b) => b.value - a.value);
}

function buildInsights(rows: ClientProfitRow[], currency: CurrencyView = GBP_VIEW): Insight[] {
  const out: Insight[] = [];
  if (rows.length === 0) return out;

  const unprofitable = rows.filter((r) => r.profit < 0).sort((a, b) => a.profit - b.profit);
  if (unprofitable.length === 1) {
    const w = unprofitable[0];
    out.push({
      tone: "alert",
      prose: `<b>${w.client}</b> (${w.service}) loses <b>${formatCurrency(Math.abs(w.profit), { compact: true, currency })}</b> on ${formatCurrency(w.revenue, { compact: true, currency })} of revenue. Reprice it or let it go.`,
    });
  } else if (unprofitable.length > 1) {
    const total = unprofitable.reduce((a, r) => a + r.profit, 0);
    out.push({
      tone: "alert",
      prose: `<b>${unprofitable.length} engagements</b> are loss-making, costing <b>${formatCurrency(Math.abs(total), { compact: true, currency })}</b> between them — worst is <b>${unprofitable[0].client}</b>.`,
    });
  }

  const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
  if (best && best.profit > 0) {
    out.push({
      tone: "win",
      prose: `<b>${best.client}</b> (${best.service}) books <b>${formatCurrency(best.profit, { compact: true, currency })}</b> profit on ${formatCurrency(best.revenue, { compact: true, currency })} revenue (<b>${formatPercent(best.margin ?? 0, 0)}</b> margin). Pattern-match this for new pitches.`,
    });
  }

  const byIntensity = groupMargins(rows, "intensity");
  if (byIntensity.length > 1) {
    const top = byIntensity[0];
    out.push({
      tone: "info",
      prose: `<b>${top.name}</b> intensity carries the strongest margin (<b>${formatPercent(top.value, 0)}</b>). Route more high-fit work through it.`,
    });
  }

  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
  const topShare = totalProfit > 0 && best ? best.profit / totalProfit : 0;
  if (topShare > 0.25) {
    out.push({
      tone: "warn",
      prose: `<b>${best.client}</b> alone is <b>${formatPercent(topShare, 0)}</b> of all client profit. That is a concentration risk, not a win.`,
    });
  }

  return out;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currency = currencyFrom(sp);

  let rows: ClientProfitRow[];
  try {
    rows = await getClientProfit();
  } catch (err) {
    return <SheetError error={err} tab="Client Profit" />;
  }

  if (rows.length === 0) {
    return (
      <SheetError
        error={new Error("The Client Profit tab has no rows yet. It fills in when a month is closed and appended.")}
        tab="Client Profit"
      />
    );
  }

  const monthsPresent = [...new Set(rows.map((r) => r.monthIso).filter((m): m is string => !!m))].sort();
  const latest = monthsPresent[monthsPresent.length - 1] ?? null;
  const periodLabel = latest ? formatMonthShort(latest) : (rows[0]?.monthLabel ?? "All data");

  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
  const avgMargin = marginOf(rows);
  const profitable = rows.filter((r) => r.profit > 0).length;
  const unprofitable = rows.filter((r) => r.profit < 0).length;
  const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const topShare = totalProfit > 0 && best ? best.profit / totalProfit : 0;

  // One bar per month present in the rollup.
  const marginByMonth = monthsPresent.map((m) => ({
    name: formatMonthShort(m),
    value: marginOf(rows.filter((r) => r.monthIso === m)) ?? 0,
  }));

  const marginTone: Tone =
    avgMargin === null ? "neutral" : avgMargin >= 0.5 ? "success" : avgMargin >= 0.3 ? "warning" : "danger";

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
      <PageHero
        eyebrow="Client profitability"
        title="Clients"
        period={periodLabel}
        source="Client Profit"
      />

      <WhatToDoNext periodLabel={periodLabel} insights={buildInsights(rows, currency)} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat
          label="Client Profit"
          value={formatCurrency(totalProfit, { compact: true, currency })}
          tone={totalProfit > 0 ? "success" : "danger"}
        />
        <KpiStat
          label="Avg Margin"
          value={avgMargin === null ? "—" : formatPercent(avgMargin)}
          tone={marginTone}
        />
        <KpiStat label="Profitable Clients" value={String(profitable)} deltaLabel={`of ${rows.length} rows`} />
        <KpiStat
          label="Unprofitable Clients"
          value={String(unprofitable)}
          tone={unprofitable === 0 ? "success" : "danger"}
          deltaLabel={unprofitable === 0 ? "all positive" : "need a review"}
        />
        <KpiStat
          label="Top Client % of Profit"
          value={totalProfit > 0 ? formatPercent(topShare) : "—"}
          tone={topShare <= 0.25 ? "success" : topShare <= 0.4 ? "warning" : "danger"}
          deltaLabel={best?.client}
        />
      </section>

      <section className="mt-8">
        <CardShell
          title="Average margin by month"
          subtitle={`Total client profit ÷ total revenue · ${monthsPresent.length} ${monthsPresent.length === 1 ? "month" : "months"} in the rollup`}
        >
          {marginByMonth.length === 0 ? (
            <EmptyChart message="No months in the Client Profit tab yet." />
          ) : (
            <VerticalBarChart data={marginByMonth} format="percent" color="#1390eb" />
          )}
        </CardShell>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardShell
          title="Margin by service"
          subtitle={`Aggregated over ${periodLabel}`}
          className="flex h-full flex-col"
        >
          <VerticalBarChart data={groupMargins(rows, "service")} format="percent" color="#22c55e" />
        </CardShell>
        <CardShell
          title="Margin by intensity"
          subtitle={`Aggregated over ${periodLabel}`}
          className="flex h-full flex-col"
        >
          <VerticalBarChart data={groupMargins(rows, "intensity")} format="percent" color="#c084fc" />
        </CardShell>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold">Client × service profitability</h2>
          <span className="text-[11px] text-muted-foreground">
            One row per client × service · default sort by profit desc
          </span>
        </div>
        <ClientProfitTable rows={rows} currency={currency} />
      </section>

      <LiveFooter sources="Client Profit" />
    </div>
  );
}
