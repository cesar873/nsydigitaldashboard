"use client";

import type { Driver, DriverMonth } from "@/lib/driver-types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { formatMonthShort } from "@/lib/months";
import { cn } from "@/lib/utils";

/**
 * Targets by month. Each cell shows the actual against its target as a filled
 * bar, so being ahead or behind reads at a glance rather than needing the
 * numbers compared by eye.
 */
export function DriverTable({
  drivers,
  months,
  currentMonthIso,
}: {
  drivers: Driver[];
  months: string[];
  currentMonthIso: string;
}) {
  const fmt = (v: number, unit: Driver["unit"]) =>
    unit === "currency" ? formatCurrency(v, { compact: true }) : formatNumber(v);

  /** Did this month meet its target? Inverse drivers want actual <= target. */
  function verdict(driver: Driver, m: DriverMonth): "hit" | "miss" | "none" {
    if (m.phase === "upcoming") return "none";
    if (driver.inverse) return m.actual <= m.target ? "hit" : "miss";
    if (m.target === 0) return m.actual > 0 ? "hit" : "none";
    return m.actual >= m.target ? "hit" : "miss";
  }

  return (
    <div className="overflow-auto rounded-xl border border-border/40">
      <table className="w-max border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-30">
            <th
              className="sticky left-0 z-30 sticky-bg border-b border-border/40 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ width: 190, minWidth: 190 }}
            >
              Target
            </th>
            {months.map((m) => (
              <th
                key={m}
                className={cn(
                  "sticky-bg border-b border-l border-border/40 px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide",
                  m === currentMonthIso ? "text-[color:var(--blue)]" : "text-muted-foreground",
                )}
                style={{ minWidth: 92 }}
              >
                {formatMonthShort(m)}
              </th>
            ))}
            <th
              className="sticky right-0 z-30 sticky-bg border-b border-l-2 border-border/60 px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ width: 118, minWidth: 118 }}
            >
              Year
            </th>
          </tr>
        </thead>

        <tbody>
          {drivers.map((driver) => {
            const elapsed = driver.months.filter((m) => m.phase !== "upcoming");
            const latest = elapsed[elapsed.length - 1];

            // A level (client count, retainer) is the latest value, not a sum.
            const isLevel = !driver.carries;

            // Headline reads as progress toward the annual figure.
            const displayYearTarget = isLevel
              ? (driver.months[driver.months.length - 1]?.target ?? 0)
              : driver.months.reduce((a, m) => a + m.target, 0);
            const displayYearActual = isLevel
              ? (latest?.actual ?? 0)
              : elapsed.reduce((a, m) => a + m.actual, 0);

            // The gap is the position as of today, so it only ever compares
            // like with like — elapsed actual against elapsed target for a flow,
            // and the latest level against that same month's target.
            const paceTarget = isLevel
              ? (latest?.target ?? 0)
              : elapsed.reduce((a, m) => a + m.target, 0);
            const paceActual = displayYearActual;
            const yearGap = driver.inverse
              ? paceTarget - paceActual
              : paceActual - paceTarget;

            return (
              <tr key={driver.key} className="border-t border-border/30">
                <td
                  className="sticky left-0 z-20 sticky-bg whitespace-nowrap px-3 py-2.5 align-middle"
                  style={{ width: 190, minWidth: 190 }}
                >
                  <div className="text-[13px] font-semibold">{driver.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {driver.inverse ? "lower is better" : isLevel ? "level" : "in month"}
                    {driver.sourceNote ? ` · ${driver.sourceNote}` : ""}
                  </div>
                </td>

                {driver.months.map((m) => {
                  const v = verdict(driver, m);
                  const ratio =
                    m.target === 0
                      ? m.actual > 0
                        ? 1
                        : 0
                      : Math.min(1.4, m.actual / m.target);
                  const isCurrent = m.monthIso === currentMonthIso;
                  return (
                    <td
                      key={m.monthIso}
                      className={cn(
                        "border-l border-border/20 px-2 py-2 align-middle",
                        isCurrent && "bg-white/[0.05]",
                      )}
                      style={{ minWidth: 92 }}
                    >
                      <div className="flex items-baseline justify-center gap-1 tabular-nums">
                        <span
                          className={cn(
                            "text-[13px] font-semibold",
                            m.phase === "upcoming" && "text-muted-foreground/50",
                            v === "hit" && "text-emerald-300",
                            v === "miss" && "text-rose-300",
                          )}
                        >
                          {m.phase === "upcoming" ? "—" : fmt(m.actual, driver.unit)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          /{fmt(m.target, driver.unit)}
                        </span>
                      </div>

                      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/25">
                        {/* Target sits at 100%; the bar overshoots when ahead. */}
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            v === "hit" && "bg-emerald-500/70",
                            v === "miss" && "bg-rose-500/70",
                            v === "none" && "bg-muted-foreground/25",
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, (ratio / 1.4) * 100))}%` }}
                        />
                        <div
                          className="absolute inset-y-0 w-px bg-foreground/50"
                          style={{ left: `${(1 / 1.4) * 100}%` }}
                          title="Target"
                        />
                      </div>
                    </td>
                  );
                })}

                <td
                  className="sticky right-0 z-20 sticky-bg border-l-2 border-border/60 px-3 py-2 align-middle"
                  style={{ width: 118, minWidth: 118 }}
                >
                  <div className="flex items-baseline justify-center gap-1 tabular-nums">
                    <span className="text-[13px] font-semibold">
                      {fmt(displayYearActual, driver.unit)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      /{fmt(displayYearTarget, driver.unit)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-center text-[10px] font-semibold tabular-nums",
                      yearGap > 0
                        ? "text-emerald-300"
                        : yearGap < 0
                          ? "text-rose-300"
                          : "text-muted-foreground",
                    )}
                    title="Position as of today"
                  >
                    {yearGap === 0
                      ? "on plan"
                      : `${yearGap > 0 ? "+" : ""}${fmt(yearGap, driver.unit)}`}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
