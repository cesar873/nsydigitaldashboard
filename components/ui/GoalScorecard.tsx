"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import { AlertCircle, AlertTriangle, Check, Minus } from "lucide-react";
import type { GoalProgress, GoalStatus } from "@/lib/planning";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

/** Four-colour status: ahead / on-plan / behind-but-recoverable / off-track. */
type DisplayStatus = GoalStatus | "at-risk";

/**
 * One hue per status, in two tones: the solid tone is what is banked, the pale
 * tone is what the current book already covers. A card never mixes hues — a
 * green card gets a green run-rate segment, not a blue one.
 *
 * green = ahead of plan · blue = on plan (±2%) · amber = behind to date but the
 * run rate still lands the year · red = behind and projected to miss.
 */
const STATUS: Record<
  DisplayStatus,
  { label: string; chip: string; solid: string; pale: string; text: string; Icon: typeof Check }
> = {
  behind: {
    label: "Off track",
    chip: "bg-rose-500/15 text-rose-300",
    solid: "bg-rose-500",
    pale: "bg-rose-500/30",
    text: "text-rose-300",
    Icon: AlertCircle,
  },
  "at-risk": {
    label: "At risk",
    chip: "bg-amber-500/15 text-amber-300",
    solid: "bg-amber-500",
    pale: "bg-amber-500/30",
    text: "text-amber-300",
    Icon: AlertTriangle,
  },
  on: {
    label: "On plan",
    chip: "bg-sky-500/15 text-sky-300",
    solid: "bg-sky-500",
    pale: "bg-sky-500/30",
    text: "text-sky-300",
    Icon: Minus,
  },
  ahead: {
    label: "Ahead",
    chip: "bg-emerald-500/15 text-emerald-300",
    solid: "bg-emerald-500",
    pale: "bg-emerald-500/30",
    text: "text-emerald-300",
    Icon: Check,
  },
};

function Row({
  label,
  value,
  tone,
  swatch,
}: {
  label: string;
  value: string;
  tone?: string;
  swatch?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {swatch && <span className={cn("h-2 w-2 shrink-0 rounded-sm", swatch)} />}
        {label}
      </span>
      <span className={cn("font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</span>
    </div>
  );
}

/**
 * The resting card is deliberately just a number and a bar. Completion, run
 * rate and the standing against plan live in a hover panel, so a row of five
 * stays scannable.
 *
 * The panel is portalled to the body on purpose: the chart cards further down
 * the page use `backdrop-filter`, which in Chromium paints above an in-flow
 * sibling no matter what z-index it carries.
 */
export function GoalScorecard({
  goal,
  currency = GBP_VIEW,
}: {
  goal: GoalProgress;
  currency?: CurrencyView;
}) {
  const fmt = (value: number, format: GoalProgress["def"]["format"]) =>
    format === "currency" ? formatCurrency(value, { compact: true, currency }) : formatNumber(value);
  const {
    def, ytdActual, ytdPlanned, contracted, completion, planToDateFraction,
    fyPlanned, fyRunRate, difference, toGo, status,
  } = goal;

  // Split "behind" into amber (recoverable) vs red (off track): amber when the
  // full-year run rate still lands within 2% of plan, red when it projects a miss.
  const shortfallPct = fyPlanned !== 0 ? difference / Math.abs(fyPlanned) : 0;
  const displayStatus: DisplayStatus =
    status === "behind" ? (shortfallPct >= -0.02 ? "at-risk" : "behind") : status;
  const st = STATUS[displayStatus];
  const denom = fyPlanned || 1;
  const banked = Math.max(0, Math.min(100, (ytdActual / denom) * 100));
  const booked = Math.max(0, Math.min(100 - banked, (contracted / denom) * 100));
  const planMark = Math.max(0, Math.min(100, planToDateFraction * 100));
  const vsPlan = ytdPlanned !== 0 ? ytdActual / ytdPlanned - 1 : null;

  return (
    <HoverCard.Root openDelay={80} closeDelay={60}>
      <HoverCard.Trigger asChild>
        <div className="cursor-default rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 backdrop-blur transition-colors hover:border-border/70">
          <div className="flex items-center gap-2">
            <span className="truncate text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
              {def.label}
            </span>
            <span
              className={cn(
                "ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                st.chip,
              )}
            >
              <st.Icon className="h-3 w-3" />
              {st.label}
            </span>
          </div>

          <div className="anton mt-1.5 text-[26px] leading-none tracking-[0.5px] tabular-nums">
            {fmt(ytdActual, def.format)}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <div className="relative flex h-4 flex-1 overflow-hidden rounded-md bg-white/[0.07]">
              <div className={cn("h-4", st.solid)} style={{ width: `${banked}%` }} />
              <div className={cn("h-4", st.pale)} style={{ width: `${booked}%` }} />
              <div
                className="absolute inset-y-0 w-[2px] bg-white/80"
                style={{ left: `${planMark}%` }}
              />
            </div>
            <span className="shrink-0 text-[16px] font-bold tabular-nums text-foreground">
              {fmt(fyPlanned, def.format)}
            </span>
          </div>
        </div>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-64 rounded-xl border border-border bg-popover p-3 text-[11px] text-popover-foreground shadow-2xl"
        >
          <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {def.label}
            </span>
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", st.text)}>
              {st.label}
            </span>
          </div>

          <div className="space-y-1.5">
            <Row label="Complete" value={formatPercent(completion, 0)} tone={st.text} />
            <Row label="Banked" value={fmt(ytdActual, def.format)} swatch={st.solid} />
            <Row label="Run rate" value={fmt(fyRunRate, def.format)} swatch={st.pale} />
            <Row label="Goal" value={fmt(fyPlanned, def.format)} />
          </div>

          <div className="mt-1.5 space-y-1.5 border-t border-border/40 pt-1.5">
            <Row
              label="vs plan to date"
              value={
                vsPlan === null || vsPlan === 0
                  ? "on plan"
                  : `${vsPlan > 0 ? "+" : ""}${formatPercent(vsPlan, 1)}`
              }
              tone={
                vsPlan === null || vsPlan === 0
                  ? "text-muted-foreground"
                  : vsPlan > 0
                    ? "text-emerald-300"
                    : "text-rose-300"
              }
            />
            <Row
              label="Run rate vs goal"
              value={
                difference === 0
                  ? "on goal"
                  : `${difference > 0 ? "+" : "−"}${fmt(Math.abs(difference), def.format)}`
              }
              tone={
                difference === 0
                  ? "text-muted-foreground"
                  : difference > 0
                    ? "text-emerald-300"
                    : "text-rose-300"
              }
            />
            <Row label="Still to go" value={fmt(toGo, def.format)} tone="text-amber-300" />
          </div>

          <HoverCard.Arrow className="fill-[var(--popover)]" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
