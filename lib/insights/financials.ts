import type { Insight } from "@/components/ui/WhatToDoNext";
import { formatCurrency, formatPercent } from "@/lib/utils";

export type FinancialsTotals = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  opex: number;
  operatingProfit: number;
  operatingMargin: number | null;
  netProfit: number | null;
  netMargin: number | null;
  endingCash: number | null;
};

/**
 * Prose branches on data state — singular/plural, severe/mild, prior/no-prior
 * (formatting.md §3.3). Never a template with number swaps.
 */
export function generateWhatToDoNextFinancials(
  cur: FinancialsTotals,
  prior: FinancialsTotals | null,
  priorLabel: string,
): Insight[] {
  const out: Insight[] = [];

  const profit = cur.netProfit ?? cur.operatingProfit;
  const margin = cur.netMargin ?? cur.operatingMargin;
  if (profit < 0) {
    out.push({
      tone: "alert",
      prose: `Running a loss of <b>${formatCurrency(Math.abs(profit), { compact: true })}</b> on ${formatCurrency(cur.revenue, { compact: true })} of revenue. Cost base needs a cut, or pricing needs a rise — the gap won't close on volume alone.`,
    });
  } else if (margin !== null && margin >= 0.15) {
    out.push({
      tone: "win",
      prose: `Healthy period: <b>${formatCurrency(profit, { compact: true })}</b> profit at a <b>${formatPercent(margin)}</b> margin. That's comfortably above the 15% line — room to reinvest.`,
    });
  } else if (margin !== null) {
    out.push({
      tone: "info",
      prose: `Profitable but thin — <b>${formatCurrency(profit, { compact: true })}</b> at <b>${formatPercent(margin)}</b>. Under 15% leaves little absorption for a bad month.`,
    });
  }

  if (prior) {
    const curM = cur.operatingMargin;
    const priorM = prior.operatingMargin;
    if (curM !== null && priorM !== null) {
      const pp = (curM - priorM) * 100;
      if (pp <= -3) {
        out.push({
          tone: "warn",
          prose: `Operating margin compressed <b>${Math.abs(pp).toFixed(1)}pp</b> vs ${priorLabel} (${formatPercent(priorM)} to ${formatPercent(curM)}). Find which cost line moved before it compounds.`,
        });
      } else if (pp >= 3) {
        out.push({
          tone: "win",
          prose: `Operating margin expanded <b>${pp.toFixed(1)}pp</b> vs ${priorLabel}, reaching <b>${formatPercent(curM)}</b>. Whatever changed, keep doing it.`,
        });
      } else if (prior.revenue > 0) {
        const revChange = (cur.revenue - prior.revenue) / prior.revenue;
        if (revChange <= -0.05) {
          out.push({
            tone: "warn",
            prose: `Revenue down <b>${formatPercent(Math.abs(revChange))}</b> vs ${priorLabel} while margin held flat — this is a volume problem, not a pricing one.`,
          });
        } else if (revChange >= 0.05) {
          out.push({
            tone: "win",
            prose: `Revenue up <b>${formatPercent(revChange)}</b> vs ${priorLabel} with margin steady at ${formatPercent(curM)} — growth is landing without dilution.`,
          });
        } else {
          out.push({
            tone: "info",
            prose: `Flat period: revenue and margin both within 5% of ${priorLabel}. Nothing broken, nothing moving.`,
          });
        }
      }
    }
  } else {
    out.push({
      tone: "info",
      prose: `No prior period to compare against — this is the earliest data in range, so treat these figures as a baseline rather than a trend.`,
    });
  }

  if (cur.grossMargin !== null) {
    if (cur.grossMargin < 0.3) {
      out.push({
        tone: "alert",
        prose: `Gross margin of <b>${formatPercent(cur.grossMargin)}</b> is below 30% — delivery cost is eating the work before overhead is even counted.`,
      });
    } else if (cur.grossMargin < 0.5) {
      out.push({
        tone: "warn",
        prose: `Gross margin at <b>${formatPercent(cur.grossMargin)}</b> sits in the 30-50% band. Serviceable, but each new client adds less than it looks like on the invoice.`,
      });
    }
  }

  if (cur.revenue > 0 && cur.opex > 0) {
    const ratio = cur.opex / cur.revenue;
    if (ratio > 0.7) {
      out.push({
        tone: "warn",
        prose: `Operating expenses consume <b>${formatPercent(ratio)}</b> of revenue. Above 70%, overhead — not delivery — is the constraint on profit.`,
      });
    }
  }

  // Cash only when populated. Never fabricated.
  if (cur.endingCash !== null) {
    if (cur.endingCash < 0) {
      out.push({
        tone: "alert",
        prose: `Ending cash is negative at <b>${formatCurrency(cur.endingCash, { compact: true })}</b>. This is a solvency question, not a reporting one.`,
      });
    } else if (prior?.endingCash != null && cur.endingCash < prior.endingCash) {
      const burn = prior.endingCash - cur.endingCash;
      out.push({
        tone: "warn",
        prose: `Cash fell <b>${formatCurrency(burn, { compact: true })}</b> vs ${priorLabel} to ${formatCurrency(cur.endingCash, { compact: true })}. Profitable months that still burn cash usually mean collections, not costs.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Ending cash <b>${formatCurrency(cur.endingCash, { compact: true })}</b>.`,
      });
    }
  }

  return out;
}
