"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type BvaCell = {
  budget: number;
  actual: number;
  /** Same period, previous year — drives the "vs Last year" view. */
  priorActual: number;
  isActual: boolean;
};

/**
 * `section` rows carry their own totals (the P&L's TOTAL … line) and act as the
 * heading for the detail rows beneath them. `margin` rows hold ratios, so they
 * format as percentages, average across a quarter, and their variance reads in
 * percentage points.
 */
export type BvaKind = "section" | "detail" | "total" | "margin";

export type BvaRow = {
  label: string;
  kind: BvaKind;
  byMonth: Map<string, BvaCell>;
  spacedBefore?: boolean;
};

type ViewMode = "actuals" | "budget" | "lastYear";
type Grain = "month" | "quarter";

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "actuals", label: "Actuals" },
  { value: "budget", label: "vs Budget" },
  { value: "lastYear", label: "vs Last year" },
];

const GRAINS: { value: Grain; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
];

const COLS: Record<ViewMode, string[]> = {
  actuals: ["Actual"],
  budget: ["Bud", "Act", "%", "$"],
  lastYear: ["LY", "Act", "%", "$"],
};

type Period = { key: string; label: string; months: string[] };

export function BudgetVsActualTable({
  rows,
  months,
  monthLabels,
}: {
  rows: BvaRow[];
  months: string[];
  monthLabels: string[];
}) {
  const [view, setView] = useState<ViewMode>("budget");
  const [grain, setGrain] = useState<Grain>("month");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverPeriod, setHoverPeriod] = useState<string | null>(null);
  const [lockedPeriod, setLockedPeriod] = useState<string | null>(null);

  const subCols = COLS[view];

  /** Calendar quarters, or the raw months. */
  const periods: Period[] = useMemo(() => {
    if (grain === "month") {
      return months.map((m, i) => ({ key: m, label: monthLabels[i], months: [m] }));
    }
    const byQuarter = new Map<string, string[]>();
    for (const m of months) {
      const [y, mm] = m.split("-").map(Number);
      const key = `${y}-Q${Math.floor((mm - 1) / 3) + 1}`;
      byQuarter.set(key, [...(byQuarter.get(key) ?? []), m]);
    }
    return [...byQuarter.entries()].map(([key, ms]) => ({
      key,
      label: key.split("-")[1],
      months: ms,
    }));
  }, [grain, months, monthLabels]);

  /** Money sums across a quarter; a margin averages. */
  function aggregate(row: BvaRow, period: Period): BvaCell | undefined {
    const cells = period.months
      .map((m) => row.byMonth.get(m))
      .filter((c): c is BvaCell => c !== undefined);
    if (cells.length === 0) return undefined;
    if (cells.length === 1) return cells[0];

    const isMargin = row.kind === "margin";
    const reduce = (pick: (c: BvaCell) => number) => {
      const total = cells.reduce((a, c) => a + pick(c), 0);
      return isMargin ? total / cells.length : total;
    };
    return {
      budget: reduce((c) => c.budget),
      actual: reduce((c) => c.actual),
      priorActual: reduce((c) => c.priorActual),
      // A quarter is only "actual" once every month in it has closed.
      isActual: cells.every((c) => c.isActual),
    };
  }

  function yearCell(row: BvaRow): BvaCell {
    const all: Period = { key: "year", label: "Year", months };
    return (
      aggregate(row, all) ?? { budget: 0, actual: 0, priorActual: 0, isActual: true }
    );
  }

  function toggle(section: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const visibleRows: BvaRow[] = [];
  let hiding = false;
  for (const row of rows) {
    if (row.kind === "section") {
      hiding = collapsed.has(row.label);
      visibleRows.push(row);
      continue;
    }
    if (row.kind === "detail" && hiding) continue;
    if (row.kind !== "detail") hiding = false;
    visibleRows.push(row);
  }

  const fmt = (v: number, kind: BvaKind) =>
    kind === "margin" ? formatPercent(v, 1) : formatCurrency(v, { compact: true });

  function ValueCells({
    cell,
    periodKey,
    rowLabel,
    kind,
    colActive,
    emphasis,
    isYear = false,
  }: {
    cell: BvaCell | undefined;
    periodKey: string;
    rowLabel: string;
    kind: BvaKind;
    colActive: boolean;
    emphasis: boolean;
    isYear?: boolean;
  }) {
    const onEnter = () => {
      if (isYear) return;
      setHoverRow(rowLabel);
      setHoverPeriod(periodKey);
    };
    const bg = colActive ? "bg-white/[0.07]" : undefined;
    const size = emphasis ? "text-[13px] font-semibold" : "text-[13px]";
    const edge = isYear ? "" : "border-r border-border/20";
    const sticky = isYear ? "sticky right-0 z-20 sticky-bg" : "";

    if (!cell) {
      return (
        <>
          {subCols.map((_, i) => (
            <td
              key={i}
              onMouseEnter={onEnter}
              className={cn(
                "px-2.5 py-2 text-right text-[13px] text-muted-foreground/40",
                i === subCols.length - 1 && edge,
                i === 0 && isYear && "border-l-2 border-border/60",
                bg,
              )}
            >
              —
            </td>
          ))}
        </>
      );
    }

    // Forecast periods stay visibly separate even in the Actuals view — they are
    // the model's expectation, not something that has happened.
    const forecast = !cell.isActual;
    const isMargin = kind === "margin";

    if (view === "actuals") {
      return (
        <td
          onMouseEnter={onEnter}
          className={cn(
            "px-2.5 py-2 text-right tabular-nums",
            size,
            edge,
            sticky,
            isYear && "border-l-2 border-border/60",
            forecast && "italic text-foreground/70",
            bg,
          )}
          style={
            forecast && !isYear
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 6px, transparent 6px 12px)",
                }
              : undefined
          }
        >
          {cell.actual === 0 && !isMargin ? (
            <span className="text-muted-foreground/40">—</span>
          ) : (
            fmt(cell.actual, kind)
          )}
        </td>
      );
    }

    const base = view === "budget" ? cell.budget : cell.priorActual;
    const diff = cell.actual - base;
    const pct = !isMargin && base !== 0 ? cell.actual / base : null;

    return (
      <>
        <td
          onMouseEnter={onEnter}
          className={cn(
            "px-2.5 py-2 text-right tabular-nums text-muted-foreground",
            size,
            forecast && "italic",
            isYear && "border-l-2 border-border/60",
            sticky,
            bg,
          )}
        >
          {base === 0 && !isMargin ? "—" : fmt(base, kind)}
        </td>
        <td
          onMouseEnter={onEnter}
          className={cn(
            "px-2.5 py-2 text-right tabular-nums",
            size,
            forecast && "italic text-foreground/70",
            isYear && "sticky-bg",
            bg,
          )}
        >
          {cell.actual === 0 && !isMargin ? (
            <span className="text-muted-foreground/40">—</span>
          ) : (
            fmt(cell.actual, kind)
          )}
        </td>
        <td
          onMouseEnter={onEnter}
          className={cn(
            "px-2.5 py-2 text-right text-[13px] tabular-nums",
            isYear && "sticky-bg",
            bg,
            pct === null
              ? "text-muted-foreground/40"
              : pct >= 1
                ? "text-emerald-300"
                : pct >= 0.95
                  ? "text-amber-300"
                  : "text-rose-300",
            forecast && "italic",
          )}
        >
          {pct === null ? "—" : formatPercent(pct, 0)}
        </td>
        <td
          onMouseEnter={onEnter}
          className={cn(
            "px-2.5 py-2 text-right text-[13px] tabular-nums",
            edge,
            isYear && "sticky-bg",
            bg,
            diff === 0
              ? "text-muted-foreground/40"
              : diff > 0
                ? "text-emerald-300"
                : "text-rose-300",
            forecast && "italic",
          )}
        >
          {diff === 0
            ? "—"
            : isMargin
              ? `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}pp`
              : `${diff > 0 ? "+" : "-"}${formatCurrency(Math.abs(diff), { compact: true })}`}
        </td>
      </>
    );
  }

  const yearWidth = view === "actuals" ? 110 : 300;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-sm shadow-sm">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                view === v.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-sm shadow-sm">
          {GRAINS.map((g) => (
            <button
              key={g.value}
              onClick={() => {
                setGrain(g.value);
                setLockedPeriod(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                grain === g.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 italic text-muted-foreground/70">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-border/40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 3px, transparent 3px 6px)",
              }}
            />
            forecast
          </span>
          · {periods.length} {grain === "month" ? "months" : "quarters"} ·{" "}
          {lockedPeriod ? "click the pinned column again to unpin" : "click a column to pin it"}
        </span>
      </div>

      <div
        className="max-h-[680px] overflow-auto rounded-xl border border-border/40"
        onMouseLeave={() => {
          setHoverRow(null);
          setHoverPeriod(null);
        }}
      >
        <table className="w-max border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-30">
              <th
                className="sticky left-0 z-30 sticky-bg border-b border-border/40 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                style={{ width: 260, minWidth: 260 }}
              >
                Category
              </th>
              {periods.map((p) => {
                const locked = lockedPeriod === p.key;
                const anyForecast = rows.some((r) => {
                  const c = aggregate(r, p);
                  return c && !c.isActual;
                });
                return (
                  <th
                    key={p.key}
                    colSpan={subCols.length}
                    onClick={() => setLockedPeriod(locked ? null : p.key)}
                    onMouseEnter={() => setHoverPeriod(p.key)}
                    className={cn(
                      "sticky-bg cursor-pointer select-none border-b border-l border-border/40 px-2.5 py-2 text-center text-[11px] font-medium uppercase tracking-wide",
                      locked
                        ? "text-sky-300"
                        : anyForecast
                          ? "italic text-muted-foreground/70 hover:text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                    )}
                    title={locked ? `Unpin ${p.label}` : `Pin ${p.label}`}
                  >
                    {p.label}
                    {anyForecast && (
                      <span className="ml-1 text-[8px] uppercase tracking-wider">fcst</span>
                    )}
                    {locked && <span className="ml-1 text-sky-300">•</span>}
                  </th>
                );
              })}
              <th
                colSpan={subCols.length}
                className="sticky right-0 z-30 sticky-bg border-b border-l-2 border-border/60 px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                style={{ width: yearWidth, minWidth: yearWidth }}
              >
                Full year
              </th>
            </tr>
            <tr className="sticky top-[37px] z-30">
              <th
                className="sticky left-0 z-30 sticky-bg border-b border-border/40 px-3 py-2"
                style={{ width: 260, minWidth: 260 }}
              />
              {periods.map((p) => (
                <Fragment key={p.key}>
                  {subCols.map((c, i) => (
                    <th
                      key={c}
                      className={cn(
                        "sticky-bg border-b border-border/40 px-2.5 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground",
                        i === 0 && "border-l border-border/40",
                        i === subCols.length - 1 && "border-r border-border/20",
                      )}
                    >
                      {c}
                    </th>
                  ))}
                </Fragment>
              ))}
              {subCols.map((c, i) => (
                <th
                  key={`year-${c}`}
                  className={cn(
                    "sticky right-0 z-30 sticky-bg border-b border-border/40 px-2.5 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground",
                    i === 0 && "border-l-2 border-border/60",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + (periods.length + 1) * subCols.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No categories match the current selection.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isSection = row.kind === "section";
                const isTotal = row.kind === "total";
                const isMargin = row.kind === "margin";
                const emphasis = isSection || isTotal;
                const rowActive = hoverRow === row.label;

                return (
                  <tr
                    key={row.label}
                    onMouseEnter={() => setHoverRow(row.label)}
                    className={cn(
                      "border-t",
                      row.spacedBefore ? "border-t-[6px] border-t-transparent" : "border-border/25",
                      isSection && "bg-white/[0.07]",
                      isTotal && "bg-white/[0.035]",
                      rowActive && !isSection && "bg-white/[0.05]",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 sticky-bg whitespace-nowrap px-3 py-2",
                        isSection && "text-[13px] font-bold uppercase tracking-[0.06em]",
                        isTotal && "text-[13px] font-bold uppercase tracking-[0.06em]",
                        isMargin && "pl-6 text-[12px] italic text-muted-foreground",
                        row.kind === "detail" && "pl-6 text-[13px] text-foreground/85",
                      )}
                      style={{ width: 260, minWidth: 260 }}
                    >
                      {isSection ? (
                        <button
                          onClick={() => toggle(row.label)}
                          className="flex items-center gap-1.5"
                        >
                          {collapsed.has(row.label) ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          {row.label}
                        </button>
                      ) : (
                        <span className="block max-w-[240px] truncate" title={row.label}>
                          {row.label}
                        </span>
                      )}
                    </td>

                    {periods.map((p) => (
                      <ValueCells
                        key={p.key}
                        cell={aggregate(row, p)}
                        periodKey={p.key}
                        rowLabel={row.label}
                        kind={row.kind}
                        colActive={lockedPeriod === p.key || hoverPeriod === p.key}
                        emphasis={emphasis}
                      />
                    ))}

                    <ValueCells
                      cell={yearCell(row)}
                      periodKey="year"
                      rowLabel={row.label}
                      kind={row.kind}
                      colActive={false}
                      emphasis={emphasis}
                      isYear
                    />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
