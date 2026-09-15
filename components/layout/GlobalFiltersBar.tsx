import { formatMonthLong } from "@/lib/months";
import { MonthMultiSelect } from "@/components/ui/MonthMultiSelect";
import { RangeSelect } from "@/components/ui/RangeSelect";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";

export function GlobalFiltersBar({
  allMonths,
  selectedMonths,
  fromIso,
  toIso,
  minIso,
  maxIso,
  lastActualMonthIso,
}: {
  allMonths: string[];
  selectedMonths: string[];
  fromIso: string;
  toIso: string;
  minIso: string;
  maxIso: string;
  lastActualMonthIso: string | null;
}) {
  return (
    <div className="sticky top-[74px] z-40 border-b border-[var(--card-border)] bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-9 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Filters
        </span>

        <MonthMultiSelect options={allMonths} selected={selectedMonths} />
        <RangeSelect fromIso={fromIso} toIso={toIso} minIso={minIso} maxIso={maxIso} />
        <CurrencyToggle />

        {lastActualMonthIso && (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
              Last actuals
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatMonthLong(lastActualMonthIso)}
            </span>
          </div>
        )}

        <RefreshButton className={lastActualMonthIso ? "" : "ml-auto"} />
      </div>
    </div>
  );
}
