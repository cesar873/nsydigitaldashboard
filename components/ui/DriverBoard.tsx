"use client";

import { AlertCircle, AlertTriangle, Check, Circle, Minus } from "lucide-react";
import { useState } from "react";
import type { Driver, DriverStatus, DriverView } from "@/lib/driver-types";
import { viewDriver } from "@/lib/driver-types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { formatMonthLong, formatMonthShort } from "@/lib/months";
import { cn } from "@/lib/utils";

const STATUS: Record<
  DriverStatus,
  { label: string; chip: string; card: string; bar: string; Icon: typeof Check }
> = {
  ahead: {
    label: "Ahead",
    chip: "bg-emerald-500/15 text-emerald-300",
    card: "border-emerald-500/35 bg-emerald-500/[0.05]",
    bar: "bg-emerald-500/70",
    Icon: Check,
  },
  on: {
    label: "On track",
    chip: "bg-sky-500/15 text-sky-300",
    card: "border-border/40 bg-card/30",
    bar: "bg-sky-500/60",
    Icon: Minus,
  },
  behind: {
    label: "Missed",
    chip: "bg-rose-500/15 text-rose-300",
    card: "border-rose-500/45 bg-rose-500/[0.07]",
    bar: "bg-rose-500/70",
    Icon: AlertCircle,
  },
  "at-risk": {
    label: "To go",
    chip: "bg-amber-500/15 text-amber-300",
    card: "border-amber-500/40 bg-amber-500/[0.05]",
    bar: "bg-amber-500/65",
    Icon: AlertTriangle,
  },
  pending: {
    label: "Upcoming",
    chip: "bg-muted/30 text-muted-foreground",
    card: "border-border/30 bg-card/20",
    bar: "bg-muted/50",
    Icon: Circle,
  },
};

function fmt(v: number, unit: Driver["unit"]) {
  return unit === "currency" ? formatCurrency(v, { compact: true }) : formatNumber(v);
}

/** One driver for the focused month: target, live actual, and what's left to do. */
function DriverCard({ view, elapsed }: { view: DriverView; elapsed: number }) {
  const { driver, month, status, carriedIn, requiredThisMonth, remaining } = view;
  const s = STATUS[status];

  // Levels are judged against where they must land by year end; flows against
  // the plan-to-date they have to recover.
  const isLevel = !driver.carries;
  const yearEndTarget = driver.months[driver.months.length - 1]?.target ?? 0;
  const catchUp = isLevel
    ? {
        value: Math.max(0, yearEndTarget - month.actual),
        caption: `more to reach the goal of ${fmt(yearEndTarget, driver.unit)}`,
      }
    : {
        value: requiredThisMonth,
        caption: driver.inverse ? "is the limit to stay on plan" : "to get back on plan for the year",
      };

  const pct =
    requiredThisMonth === 0
      ? month.actual > 0
        ? 100
        : 0
      : Math.max(0, Math.min(100, (month.actual / requiredThisMonth) * 100));

  return (
    <div className={cn("rounded-xl border px-4 py-3.5", s.card)}>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          {driver.label}
        </span>
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            s.chip,
          )}
        >
          <s.Icon className="h-3 w-3" />
          {s.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="anton text-[26px] leading-none tracking-[0.5px] tabular-nums">
          {fmt(month.actual, driver.unit)}
        </span>
        <span className="text-[12px] text-muted-foreground">
          of {fmt(month.target, driver.unit)}
          {driver.inverse ? " allowed" : " target"}
        </span>
      </div>

      {/*
        The standing target never moves — the second line says what it would
        actually take to be square with the year. For a flow that is this
        month's target plus anything carried in; for a level (client count,
        retainer) it is the distance to the year-end goal.
      */}
      <div className="mt-1 flex items-baseline gap-1 text-[11px]">
        <span
          className={cn(
            "font-semibold tabular-nums",
            carriedIn > 0 ? "text-amber-300" : "text-foreground/70",
          )}
        >
          {fmt(catchUp.value, driver.unit)}
        </span>
        <span className="text-muted-foreground">{catchUp.caption}</span>
      </div>

      <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/25">
        <div className={cn("h-1.5 rounded-full", s.bar)} style={{ width: `${pct}%` }} />
        {month.phase === "current" && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/60"
            title={`${formatPercent(elapsed, 0)} of the month gone`}
            style={{ left: `${Math.min(100, elapsed * 100)}%` }}
          />
        )}
      </div>

    </div>
  );
}

export function DriverBoard({
  drivers,
  months,
  currentMonthIso,
  elapsed,
}: {
  drivers: Driver[];
  months: string[];
  currentMonthIso: string;
  elapsed: number;
}) {
  const [focus, setFocus] = useState(
    months.includes(currentMonthIso) ? currentMonthIso : (months[0] ?? ""),
  );

  const views = drivers
    .map((d) => viewDriver(d, focus))
    .filter((v): v is DriverView => v !== null);

  /** A month is off track if any carrying driver missed it. */
  const monthStatus = (m: string): DriverStatus => {
    const vs = drivers
      .map((d) => viewDriver(d, m))
      .filter((v): v is DriverView => v !== null && v.driver.carries);
    if (vs.length === 0) return "pending";
    if (vs.some((v) => v.status === "behind")) return "behind";
    if (vs.some((v) => v.status === "at-risk")) return "at-risk";
    if (vs.every((v) => v.status === "ahead")) return "ahead";
    return "on";
  };

  const isFocusCurrent = focus === currentMonthIso;

  return (
    <div>
      {/* Month strip — full-year context, and one click to next month. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {months.map((m) => {
          const st = monthStatus(m);
          const active = m === focus;
          const isCurrent = m === currentMonthIso;
          return (
            <button
              key={m}
              onClick={() => setFocus(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "border-[var(--blue)] bg-[color:var(--blue)]/15 text-foreground"
                  : "border-border/40 bg-card/30 text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
              title={isCurrent ? "Month in progress" : undefined}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  st === "behind" && "bg-rose-400",
                  st === "at-risk" && "bg-amber-400",
                  st === "ahead" && "bg-emerald-400",
                  st === "on" && "bg-sky-400",
                  st === "pending" && "bg-muted-foreground/40",
                )}
              />
              {formatMonthShort(m)}
              {isCurrent && <span className="text-[9px] text-[color:var(--blue)]">live</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{formatMonthLong(focus)}</h3>
          {isFocusCurrent && (
            <span className="rounded bg-[color:var(--blue)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--blue)]">
              {formatPercent(elapsed, 0)} of month gone
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {views.map((v) => (
          <DriverCard key={v.driver.key} view={v} elapsed={elapsed} />
        ))}
      </div>

    </div>
  );
}
