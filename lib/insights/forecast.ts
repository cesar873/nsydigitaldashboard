import type { Insight } from "@/components/ui/WhatToDoNext";
import type { GoalProgress } from "@/lib/planning";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

function fmt(v: number, f: "currency" | "number") {
  return f === "currency" ? formatCurrency(v, { compact: true }) : formatNumber(v);
}

export function generateWhatToDoNextForecast({
  goals,
  scenarioLabel,
  year,
  paceFraction,
  monthLabel,
  monthMisses,
  elapsedMonths,
  duplicateLabels,
}: {
  goals: GoalProgress[];
  scenarioLabel: string;
  year: number;
  paceFraction: number;
  monthLabel: string;
  monthMisses: { label: string; actual: number; plan: number }[];
  elapsedMonths: number;
  duplicateLabels: string[];
}): Insight[] {
  const out: Insight[] = [];
  // "Finance Plan" yields the label "Plan", which would read as "the Plan plan".
  const planName = /^plan$/i.test(scenarioLabel) ? "plan" : `${scenarioLabel} plan`;
  const revenue = goals.find((g) => g.def.key === "revenue");
  const profit = goals.find((g) => g.def.key === "operatingProfit");

  // 1. Headline: actual vs the plan's OWN schedule to date.
  if (revenue) {
    const { ytdActual, ytdPlanned } = revenue;
    const vsPlan = ytdPlanned !== 0 ? ytdActual / ytdPlanned - 1 : null;
    if (vsPlan === null) {
      out.push({
        tone: "info",
        prose: `The ${scenarioLabel} scenario has no revenue planned for the ${elapsedMonths} elapsed ${elapsedMonths === 1 ? "month" : "months"} of ${year}, so there is nothing to measure against yet.`,
      });
    } else if (vsPlan > 0.02) {
      out.push({
        tone: "win",
        prose: `Revenue is <b>${formatPercent(vsPlan, 1)}</b> ahead of ${planName} to date — <b>${fmt(ytdActual, "currency")}</b> booked against <b>${fmt(ytdPlanned, "currency")}</b> planned.`,
      });
    } else if (vsPlan < -0.02) {
      out.push({
        tone: "alert",
        prose: `Revenue is <b>${formatPercent(Math.abs(vsPlan), 1)}</b> behind ${planName} to date — <b>${fmt(ytdActual, "currency")}</b> against <b>${fmt(ytdPlanned, "currency")}</b> planned, a <b>${fmt(Math.abs(ytdActual - ytdPlanned), "currency")}</b> gap.`,
      });
    } else {
      out.push({
        tone: "win",
        prose: `Revenue is on ${planName} to date — <b>${fmt(ytdActual, "currency")}</b> booked against <b>${fmt(ytdPlanned, "currency")}</b> planned across ${elapsedMonths} ${elapsedMonths === 1 ? "month" : "months"}.`,
      });
    }
  }

  // 2. Back-loading risk: on plan today, but the plan leaves most of the year to do.
  if (revenue && revenue.fyPlanned !== 0) {
    const remainingShare = 1 - revenue.planToDateFraction;
    const remainingAmount = revenue.fyPlanned - revenue.ytdPlanned;
    const timeLeft = 1 - paceFraction;
    if (remainingShare > timeLeft + 0.1) {
      out.push({
        tone: "warn",
        prose: `The plan is back-loaded: <b>${formatPercent(remainingShare, 0)}</b> of the ${year} target (<b>${fmt(remainingAmount, "currency")}</b>) sits in the remaining <b>${formatPercent(timeLeft, 0)}</b> of the year. Being on plan today does not mean the year is safe.`,
      });
    }
  }

  // 3. Full-year run rate vs plan.
  if (revenue && revenue.fyPlanned !== 0) {
    const pct = revenue.difference / Math.abs(revenue.fyPlanned);
    if (pct <= -0.05) {
      out.push({
        tone: "warn",
        prose: `Full-year run rate lands at <b>${fmt(revenue.fyRunRate, "currency")}</b> against a <b>${fmt(revenue.fyPlanned, "currency")}</b> plan — a <b>${fmt(Math.abs(revenue.difference), "currency")}</b> shortfall. Either the back half changes or the plan does.`,
      });
    } else if (pct >= 0.05) {
      out.push({
        tone: "win",
        prose: `Run rate projects <b>${fmt(revenue.fyRunRate, "currency")}</b> against a <b>${fmt(revenue.fyPlanned, "currency")}</b> plan — <b>${fmt(revenue.difference, "currency")}</b> above target. Worth resetting the plan upward rather than banking the beat.`,
      });
    }
  }

  // 4. Profit divergence — revenue can hit while profit misses.
  if (profit && revenue && profit.ytdPlanned !== 0 && revenue.ytdPlanned !== 0) {
    const profitVs = profit.ytdActual / profit.ytdPlanned - 1;
    const revVs = revenue.ytdActual / revenue.ytdPlanned - 1;
    if (profitVs < -0.05 && revVs >= -0.02) {
      out.push({
        tone: "warn",
        prose: `Revenue is on plan but operating profit is <b>${formatPercent(Math.abs(profitVs), 1)}</b> behind it. Growth is landing at a worse margin than the plan assumed — check cost of sales.`,
      });
    } else if (profitVs > 0.05) {
      out.push({
        tone: "win",
        prose: `Operating profit is <b>${formatPercent(profitVs, 1)}</b> ahead of plan to date.`,
      });
    }
  }

  // 5. Which months missed.
  if (monthMisses.length === 1) {
    const m = monthMisses[0];
    out.push({
      tone: "warn",
      prose: `One month missed its revenue plan: <b>${m.label}</b> came in at ${formatCurrency(m.actual, { compact: true })} against ${formatCurrency(m.plan, { compact: true })}.`,
    });
  } else if (monthMisses.length > 1) {
    const worst = [...monthMisses].sort((a, b) => a.actual - a.plan - (b.actual - b.plan))[0];
    out.push({
      tone: monthMisses.length >= 4 ? "alert" : "warn",
      prose: `<b>${monthMisses.length} of ${elapsedMonths} elapsed months</b> missed their revenue plan — worst was <b>${worst.label}</b>, short by ${formatCurrency(Math.abs(worst.actual - worst.plan), { compact: true })}.${monthMisses.length >= 4 ? " At that frequency the plan is the problem, not the month." : ""}`,
    });
  } else if (elapsedMonths > 0) {
    out.push({
      tone: "win",
      prose: `All ${elapsedMonths} elapsed ${elapsedMonths === 1 ? "month" : "months"} of ${year} hit ${elapsedMonths === 1 ? "its" : "their"} monthly revenue plan.`,
    });
  }

  // 6. Data integrity — a duplicated row makes "same plan, zero variance" false.
  if (duplicateLabels.length > 0) {
    const list = duplicateLabels.map((l) => `<b>${l}</b>`).join(", ");
    const one = duplicateLabels.length === 1;
    out.push({
      tone: "alert",
      prose: `The ${scenarioLabel} tab repeats ${one ? "a row" : "rows"} (${list}), so ${one ? "it is" : "they are"} double-counted into its totals. Months where plan and actual should match will show a false variance until the duplicate ${one ? "row is" : "rows are"} removed from the sheet.`,
    });
  }

  // 7. Owner drawing — discretionary, so worth its own line.
  const owner = goals.find((g) => g.def.key === "ownerDrawing");
  if (owner && owner.fyPlanned !== 0 && owner.difference > 0) {
    out.push({
      tone: "info",
      prose: `Owner drawing projects <b>${fmt(owner.fyRunRate, "currency")}</b> against <b>${fmt(owner.fyPlanned, "currency")}</b> planned — <b>${fmt(owner.difference, "currency")}</b> over. Check ${monthLabel} against the plan.`,
    });
  }

  return out;
}
