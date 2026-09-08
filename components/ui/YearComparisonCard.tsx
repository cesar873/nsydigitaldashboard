import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type YearStat = {
  label: string;
  format: "currency" | "percent";
  /** Same calendar months as the current year's elapsed period. */
  ytd: number | null;
  /** Full year. For the current year this is the run rate. */
  fy: number | null;
};

export type YearComparison = {
  year: number;
  isCurrent: boolean;
  /** Months of this year with actuals, for the "YTD through X" caption. */
  ytdLabel: string;
  stats: YearStat[];
};

function fmt(v: number | null, f: YearStat["format"]) {
  if (v === null) return "—";
  return f === "currency" ? formatCurrency(v, { compact: true }) : formatPercent(v);
}

/**
 * One year per card, two value columns: the same year-to-date window as the
 * current year (so the comparison is like-for-like) and the full year.
 */
export function YearComparisonCard({ data }: { data: YearComparison }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border p-5 backdrop-blur-sm",
        data.isCurrent
          ? "border-[var(--blue)]/40 bg-[color:var(--blue)]/[0.05]"
          : "border-border/40 bg-card/30",
      )}
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span className="anton text-[22px] leading-none tracking-[0.5px]">{data.year}</span>
        {data.isCurrent && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            Current
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-0.5">
        <span />
        <span className="text-right text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {data.ytdLabel}
        </span>
        <span className="text-right text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {data.isCurrent ? "Run rate" : "Full year"}
        </span>

        {data.stats.map((stat) => (
          <div key={stat.label} className="col-span-3 grid grid-cols-subgrid items-baseline border-t border-border/30 py-1.5">
            <span className="text-[12px] text-muted-foreground">{stat.label}</span>
            <span className="text-right text-[13px] font-semibold tabular-nums">
              {fmt(stat.ytd, stat.format)}
            </span>
            <span
              className={cn(
                "text-right text-[13px] font-semibold tabular-nums",
                data.isCurrent ? "text-sky-200" : "text-foreground/80",
              )}
            >
              {fmt(stat.fy, stat.format)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
