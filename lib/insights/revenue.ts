import type { Insight } from "@/components/ui/WhatToDoNext";
import type { ClientRevenue } from "@/lib/sources/client-revenue";
import { formatCurrency, formatPercent } from "@/lib/utils";

function totalFor(data: ClientRevenue, months: string[]): number {
  return data.rows.reduce(
    (acc, r) => acc + months.reduce((a, m) => a + (r.byMonth.get(m) ?? 0), 0),
    0,
  );
}

function perClient(data: ClientRevenue, months: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of data.rows) {
    const v = months.reduce((a, m) => a + (r.byMonth.get(m) ?? 0), 0);
    if (v !== 0) out.set(r.client, (out.get(r.client) ?? 0) + v);
  }
  return out;
}

export function generateWhatToDoNextRevenue(
  data: ClientRevenue,
  selected: string[],
  prior: string[],
  priorLabel: string,
): Insight[] {
  const out: Insight[] = [];
  const cur = perClient(data, selected);
  const prev = perClient(data, prior);
  const curTotal = totalFor(data, selected);
  const prevTotal = totalFor(data, prior);

  // 1. Trend.
  if (prevTotal > 0) {
    const change = (curTotal - prevTotal) / prevTotal;
    if (change >= 0.05) {
      out.push({
        tone: "win",
        prose: `Revenue up <b>${formatPercent(change)}</b> vs ${priorLabel}, to <b>${formatCurrency(curTotal, { compact: true })}</b> across ${cur.size} billing ${cur.size === 1 ? "client" : "clients"}.`,
      });
    } else if (change <= -0.05) {
      out.push({
        tone: "warn",
        prose: `Revenue down <b>${formatPercent(Math.abs(change))}</b> vs ${priorLabel}, to <b>${formatCurrency(curTotal, { compact: true })}</b>. Check the decliners below before assuming it's seasonal.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Revenue held within 5% of ${priorLabel} at <b>${formatCurrency(curTotal, { compact: true })}</b>.`,
      });
    }
  } else {
    out.push({
      tone: "info",
      prose: `<b>${formatCurrency(curTotal, { compact: true })}</b> billed across ${cur.size} ${cur.size === 1 ? "client" : "clients"}. No prior period in range to compare against.`,
    });
  }

  // 2. Decliners — severity branches on how deep the drop is.
  const decliners = [...cur.entries()]
    .map(([client, v]) => ({ client, v, was: prev.get(client) ?? 0 }))
    .filter((d) => d.was > 0 && d.v < d.was)
    .map((d) => ({ ...d, drop: (d.was - d.v) / d.was }))
    .sort((a, b) => b.was - b.v - (a.was - a.v));

  const severe = decliners.filter((d) => d.drop >= 0.5);
  const moderate = decliners.filter((d) => d.drop >= 0.2 && d.drop < 0.5);

  if (severe.length === 1) {
    const d = severe[0];
    out.push({
      tone: "alert",
      prose: `<b>${d.client}</b> fell ${formatPercent(d.drop)} vs ${priorLabel} (${formatCurrency(d.was, { compact: true })} to ${formatCurrency(d.v, { compact: true })}). A drop that size is usually a scope change or a churn signal — confirm which.`,
    });
  } else if (severe.length > 1) {
    out.push({
      tone: "alert",
      prose: `<b>${severe.length} clients</b> dropped more than half their billing vs ${priorLabel} — worst is <b>${severe[0].client}</b> at ${formatPercent(severe[0].drop)} down. Treat as a pattern, not coincidence.`,
    });
  } else if (moderate.length > 0) {
    out.push({
      tone: "warn",
      prose: `<b>${moderate[0].client}</b> down ${formatPercent(moderate[0].drop)} vs ${priorLabel}${moderate.length > 1 ? `, plus ${moderate.length - 1} other${moderate.length > 2 ? "s" : ""} in the 20-50% range` : ""}.`,
    });
  }

  // 3. New billing.
  const newClients = [...cur.keys()].filter((c) => !prev.has(c));
  if (newClients.length === 1) {
    out.push({
      tone: "win",
      prose: `<b>${newClients[0]}</b> started billing this period at ${formatCurrency(cur.get(newClients[0])!, { compact: true })}.`,
    });
  } else if (newClients.length > 1) {
    const added = newClients.reduce((a, c) => a + (cur.get(c) ?? 0), 0);
    out.push({
      tone: "win",
      prose: `<b>${newClients.length} new clients</b> came online, adding ${formatCurrency(added, { compact: true })} — led by ${newClients[0]}.`,
    });
  }

  // 4. Concentration.
  const ranked = [...cur.values()].sort((a, b) => b - a);
  if (curTotal > 0 && ranked.length > 0) {
    const top1 = ranked[0] / curTotal;
    const top3 = ranked.slice(0, 3).reduce((a, b) => a + b, 0) / curTotal;
    const topName = [...cur.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (top1 > 0.25) {
      out.push({
        tone: "warn",
        prose: `<b>${topName}</b> alone is ${formatPercent(top1)} of revenue. Losing one client shouldn't cost a quarter of the book.`,
      });
    } else if (top3 > 0.5) {
      out.push({
        tone: "warn",
        prose: `Top 3 clients carry <b>${formatPercent(top3)}</b> of revenue. Concentrated, though no single client dominates.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Revenue is well spread — top client is ${formatPercent(top1)}, top 3 are ${formatPercent(top3)}.`,
      });
    }
  }

  return out;
}
