import type { Insight } from "@/components/ui/WhatToDoNext";
import type { Metric } from "@/lib/sources/analytics";
import { metricBy, metricValue } from "@/lib/sources/analytics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export function generateWhatToDoNextAnalytics({
  metrics,
  selected,
  prior,
  priorLabel,
  hasPrior,
  currency = GBP_VIEW,
}: {
  metrics: Metric[];
  selected: string[];
  prior: string[];
  priorLabel: string;
  hasPrior: boolean;
  currency?: CurrencyView;
}): Insight[] {
  const out: Insight[] = [];
  const val = (key: string, months: string[]) => metricValue(metricBy(metrics, key), months);

  const ltv = val("ltv", selected);
  const cac = val("cac", selected);
  const ratio = val("ltvCac", selected);
  const churn = val("churn", selected);
  const churnPrior = hasPrior ? val("churn", prior) : null;
  const signed = val("clientsSigned", selected) ?? 0;
  const lost = val("clientsLost", selected) ?? 0;

  // 1. Unit economics headline.
  if (ratio !== null && ratio > 0 && ltv !== null && cac !== null) {
    if (ratio >= 3) {
      out.push({
        tone: "win",
        prose: `LTV/CAC at <b>${ratio.toFixed(1)}×</b> — earning back <b>${formatCurrency(ltv, { compact: true, currency })}</b> per <b>${formatCurrency(cac, { compact: true, currency })}</b> of acquisition spend. The acquisition machine is paying off; this is where to press.`,
      });
    } else if (ratio >= 1) {
      out.push({
        tone: "warn",
        prose: `LTV/CAC at <b>${ratio.toFixed(1)}×</b> is above break-even but under the 3× mark. Every new client is worth winning, but only just — payback is slow enough to strain cash.`,
      });
    } else {
      out.push({
        tone: "alert",
        prose: `LTV/CAC at <b>${ratio.toFixed(1)}×</b> — acquisition costs more than the client returns. Every new client destroys value until either CAC falls or retention improves.`,
      });
    }
  }

  // 2. Churn, with direction where there is a prior period.
  if (churn !== null && churn > 0) {
    if (churnPrior !== null && churnPrior > 0) {
      const pp = (churn - churnPrior) * 100;
      if (pp >= 2) {
        out.push({
          tone: "alert",
          prose: `Churn jumped from <b>${formatPercent(churnPrior)}</b> to <b>${formatPercent(churn)}</b> vs ${priorLabel}${lost > 0 ? ` (${formatNumber(lost)} clients lost)` : ""}. Run exit interviews — a jump that size is rarely random.`,
        });
      } else if (pp <= -2) {
        out.push({
          tone: "win",
          prose: `Churn improved from <b>${formatPercent(churnPrior)}</b> to <b>${formatPercent(churn)}</b> vs ${priorLabel}. Retention work is landing.`,
        });
      } else if (churn > 0.1) {
        out.push({
          tone: "warn",
          prose: `Churn steady at <b>${formatPercent(churn)}</b> — steady, but above 10% a month means replacing the whole book inside a year.`,
        });
      }
    } else if (churn > 0.1) {
      out.push({
        tone: "warn",
        prose: `Churn at <b>${formatPercent(churn)}</b>. Above 10% a month the book turns over completely within a year.`,
      });
    }
  }

  // 3. Net client movement.
  if (signed !== 0 || lost !== 0) {
    const net = signed - lost;
    if (net > 0) {
      out.push({
        tone: "win",
        prose: `Net <b>+${formatNumber(net)} client${net === 1 ? "" : "s"}</b> over the period (${formatNumber(signed)} signed, ${formatNumber(lost)} lost). Acquisition is outrunning churn.`,
      });
    } else if (net < 0) {
      out.push({
        tone: "alert",
        prose: `Net <b>${formatNumber(net)} client${net === -1 ? "" : "s"}</b> over the period (${formatNumber(signed)} signed, ${formatNumber(lost)} lost). Acquisition isn't keeping up with churn.`,
      });
    } else {
      out.push({
        tone: "info",
        prose: `Flat book: ${formatNumber(signed)} signed and ${formatNumber(lost)} lost cancel out. Growth is being replaced, not added.`,
      });
    }
  }

  // 4. Revenue per employee — capacity efficiency.
  const rpe = val("revPerEmployee", selected);
  const rpePrior = hasPrior ? val("revPerEmployee", prior) : null;
  if (rpe !== null && rpe > 0 && rpePrior !== null && rpePrior > 0) {
    const change = (rpe - rpePrior) / rpePrior;
    if (change <= -0.1) {
      out.push({
        tone: "warn",
        prose: `Revenue per employee fell <b>${formatPercent(Math.abs(change))}</b> vs ${priorLabel} to ${formatCurrency(rpe, { compact: true, currency })} — headcount is growing faster than the book.`,
      });
    } else if (change >= 0.1) {
      out.push({
        tone: "win",
        prose: `Revenue per employee up <b>${formatPercent(change)}</b> vs ${priorLabel} to ${formatCurrency(rpe, { compact: true, currency })} — the team is carrying more without more people.`,
      });
    }
  }

  // 5. CAC direction.
  const cacPrior = hasPrior ? val("cac", prior) : null;
  if (cac !== null && cac > 0 && cacPrior !== null && cacPrior > 0) {
    const change = (cac - cacPrior) / cacPrior;
    if (change >= 0.25) {
      out.push({
        tone: "warn",
        prose: `CAC rose <b>${formatPercent(change)}</b> vs ${priorLabel} to ${formatCurrency(cac, { compact: true, currency })}. Watch it against LTV before scaling spend.`,
      });
    }
  }

  return out;
}
