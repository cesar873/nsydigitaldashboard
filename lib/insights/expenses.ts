import type { Insight } from "@/components/ui/WhatToDoNext";
import type { Transaction } from "@/lib/sources/transactions";
import type { ExpenseCategory } from "@/lib/sources/expense-categories";
import { costByCategory, costByVendor, totalCost } from "@/lib/sources/transactions";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function generateWhatToDoNextExpenses(
  rows: Transaction[],
  selected: string[],
  prior: string[],
  priorLabel: string,
  revenue: number,
): Insight[] {
  const out: Insight[] = [];
  const cur = totalCost(rows, selected);
  const prev = totalCost(rows, prior);

  // 1. Total trend.
  if (prev > 0) {
    const change = (cur - prev) / prev;
    if (change >= 0.05) {
      out.push({
        tone: "warn",
        prose: `Spend up <b>${formatPercent(change)}</b> vs ${priorLabel}, to <b>${formatCurrency(cur, { compact: true })}</b>. Check whether revenue moved with it.`,
      });
    } else if (change <= -0.05) {
      out.push({
        tone: "win",
        prose: `Spend down <b>${formatPercent(Math.abs(change))}</b> vs ${priorLabel}, to <b>${formatCurrency(cur, { compact: true })}</b>.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Spend flat vs ${priorLabel} at <b>${formatCurrency(cur, { compact: true })}</b>.`,
      });
    }
  } else {
    out.push({
      tone: "info",
      prose: `<b>${formatCurrency(cur, { compact: true })}</b> of spend in this period. No prior period in range.`,
    });
  }

  // 2. Expenses as share of revenue.
  if (revenue > 0) {
    const ratio = cur / revenue;
    if (ratio > 0.7) {
      out.push({
        tone: "alert",
        prose: `Costs are <b>${formatPercent(ratio)}</b> of revenue. Above 70% there is almost no margin left for a bad month.`,
      });
    } else if (ratio > 0.5) {
      out.push({
        tone: "warn",
        prose: `Costs run at <b>${formatPercent(ratio)}</b> of revenue — inside tolerance, but the 50% line is the one to defend.`,
      });
    } else {
      out.push({
        tone: "win",
        prose: `Costs at <b>${formatPercent(ratio)}</b> of revenue leaves healthy headroom.`,
      });
    }
  }

  // 3. Category movement.
  const curCats = new Map(costByCategory(rows, selected).map((c) => [c.name, c.value]));
  const prevCats = new Map(costByCategory(rows, prior).map((c) => [c.name, c.value]));
  const risers = [...curCats.entries()]
    .map(([name, v]) => ({ name, v, was: prevCats.get(name) ?? 0 }))
    .filter((c) => c.was > 0 && c.v > c.was)
    .map((c) => ({ ...c, up: (c.v - c.was) / c.was }))
    .sort((a, b) => b.v - b.was - (a.v - a.was));

  if (risers.length === 1) {
    out.push({
      tone: "warn",
      prose: `<b>${risers[0].name}</b> rose ${formatPercent(risers[0].up)} vs ${priorLabel}, to ${formatCurrency(risers[0].v, { compact: true })}.`,
    });
  } else if (risers.length > 1) {
    out.push({
      tone: "warn",
      prose: `<b>${risers.length} cost categories</b> grew vs ${priorLabel} — worst is <b>${risers[0].name}</b> at +${formatPercent(risers[0].up)} (${formatCurrency(risers[0].v, { compact: true })}).`,
    });
  }

  // 4. Vendor concentration.
  const vendors = costByVendor(rows, selected);
  if (cur > 0 && vendors.length > 0 && vendors[0].value / cur > 0.15) {
    out.push({
      tone: "info",
      prose: `<b>${vendors[0].name}</b> is ${formatPercent(vendors[0].value / cur)} of total spend — worth a rate conversation at that size.`,
    });
  }

  return out;
}

/**
 * Finance-Model-driven variant, used when the raw ledger isn't classified into
 * expense rows (e.g. a Xero bank export with no Account Type column). Reads the
 * same P&L cost lines that feed the category chart, so every figure ties to the
 * Finance Model rather than a re-derived ledger total.
 */
export function generateWhatToDoNextExpensesFromModel(
  categories: ExpenseCategory[],
  selected: string[],
  prior: string[],
  priorLabel: string,
  revenue: number,
): Insight[] {
  const out: Insight[] = [];
  const sumOver = (months: string[]) =>
    categories.reduce(
      (acc, c) => acc + months.reduce((s, m) => s + (c.byMonth.get(m) ?? 0), 0),
      0,
    );
  const catSum = (c: ExpenseCategory, months: string[]) =>
    months.reduce((s, m) => s + (c.byMonth.get(m) ?? 0), 0);

  const cur = sumOver(selected);
  const prev = sumOver(prior);

  // 1. Total trend.
  if (prev > 0) {
    const change = (cur - prev) / prev;
    if (change >= 0.05) {
      out.push({
        tone: "warn",
        prose: `Spend up <b>${formatPercent(change)}</b> vs ${priorLabel}, to <b>${formatCurrency(cur, { compact: true })}</b>. Check whether revenue moved with it.`,
      });
    } else if (change <= -0.05) {
      out.push({
        tone: "win",
        prose: `Spend down <b>${formatPercent(Math.abs(change))}</b> vs ${priorLabel}, to <b>${formatCurrency(cur, { compact: true })}</b>.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Spend flat vs ${priorLabel} at <b>${formatCurrency(cur, { compact: true })}</b>.`,
      });
    }
  } else {
    out.push({
      tone: "info",
      prose: `<b>${formatCurrency(cur, { compact: true })}</b> of spend in this period. No prior period in range.`,
    });
  }

  // 2. Expenses as share of revenue.
  if (revenue > 0) {
    const ratio = cur / revenue;
    if (ratio > 0.7) {
      out.push({
        tone: "alert",
        prose: `Costs are <b>${formatPercent(ratio)}</b> of revenue. Above 70% there is almost no margin left for a bad month.`,
      });
    } else if (ratio > 0.5) {
      out.push({
        tone: "warn",
        prose: `Costs run at <b>${formatPercent(ratio)}</b> of revenue — inside tolerance, but the 50% line is the one to defend.`,
      });
    } else {
      out.push({
        tone: "win",
        prose: `Costs at <b>${formatPercent(ratio)}</b> of revenue leaves healthy headroom.`,
      });
    }
  }

  // 3. Category movement.
  const risers = categories
    .map((c) => ({ name: c.label, v: catSum(c, selected), was: catSum(c, prior) }))
    .filter((c) => c.was > 0 && c.v > c.was)
    .map((c) => ({ ...c, up: (c.v - c.was) / c.was }))
    .sort((a, b) => b.v - b.was - (a.v - a.was));

  if (risers.length === 1) {
    out.push({
      tone: "warn",
      prose: `<b>${risers[0].name}</b> rose ${formatPercent(risers[0].up)} vs ${priorLabel}, to ${formatCurrency(risers[0].v, { compact: true })}.`,
    });
  } else if (risers.length > 1) {
    out.push({
      tone: "warn",
      prose: `<b>${risers.length} cost categories</b> grew vs ${priorLabel} — worst is <b>${risers[0].name}</b> at +${formatPercent(risers[0].up)} (${formatCurrency(risers[0].v, { compact: true })}).`,
    });
  }

  // 4. Biggest single line.
  const ranked = categories
    .map((c) => ({ name: c.label, v: catSum(c, selected) }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v);
  if (cur > 0 && ranked.length > 0 && ranked[0].v / cur > 0.2) {
    out.push({
      tone: "info",
      prose: `<b>${ranked[0].name}</b> is ${formatPercent(ranked[0].v / cur)} of total spend — the biggest single cost line.`,
    });
  }

  return out;
}
