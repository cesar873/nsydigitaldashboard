"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { MultiSelectFilter, matchesFilter } from "@/components/ui/MultiSelectFilter";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export type MatrixRow = {
  key: string;
  primary: string;
  /** Always visible, alongside the primary column. */
  secondary?: string;
  status?: string;
  /** Keyed by DetailColumn.key — hidden behind "Hide details". */
  details?: Record<string, string>;
  /** monthIso → value */
  byMonth: Map<string, number>;
};

export type DetailColumn = { key: string; label: string; width?: number };
export type MatrixColumn = { iso: string; label: string; isForecast: boolean };

const INFLOW_RGB = "16,185,129";

const ACCENTS = {
  sky: "34,211,238",
  rose: "244,63,94",
  emerald: "16,185,129",
} as const;

export type Accent = keyof typeof ACCENTS;

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const lower = status.toLowerCase();
  let tone: "active" | "planned" | "muted" | "neutral" = "neutral";
  if (/^plan/i.test(status)) tone = "planned";
  else if (/active/i.test(lower)) tone = "active";
  else if (/(churn|lost|past|inactive|paused)/i.test(lower)) tone = "muted";
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
        tone === "active" && "bg-emerald-500/15 text-emerald-300",
        tone === "planned" && "bg-sky-500/15 text-sky-300",
        tone === "muted" && "bg-muted/30 text-muted-foreground",
        tone === "neutral" && "bg-white/[0.06] text-foreground/80",
      )}
      title={status}
    >
      {status}
    </span>
  );
}

/**
 * Rows × month columns with a heat-mapped value in every cell. Powers the
 * revenue-by-client, cost-by-category and all-costs tables.
 *
 * `share` mode divides each cell by `shareDenominator` for that month, falling
 * back to the column total when no denominator is supplied.
 */
export function MonthMatrixTable({
  rows,
  columns,
  primaryLabel,
  secondaryLabel,
  showStatus = false,
  detailColumns = [],
  searchPlaceholder = "Search…",
  filterLabel,
  statusFilterLabel = "Status",
  defaultStatus,
  accent = "sky",
  shareDenominator,
  shareLabel = "% of total",
  absoluteLabel = "Amount",
  totalLabel = "Total",
  hideEmptyRows = true,
  signedValues = false,
  currency = GBP_VIEW,
}: {
  rows: MatrixRow[];
  columns: MatrixColumn[];
  primaryLabel: string;
  secondaryLabel?: string;
  showStatus?: boolean;
  detailColumns?: DetailColumn[];
  searchPlaceholder?: string;
  filterLabel?: string;
  statusFilterLabel?: string;
  defaultStatus?: string[];
  accent?: Accent;
  shareDenominator?: Map<string, number>;
  shareLabel?: string;
  absoluteLabel?: string;
  totalLabel?: string;
  hideEmptyRows?: boolean;
  /** Negative values are inflows (refunds) and render green, not red. */
  signedValues?: boolean;
  currency?: CurrencyView;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"absolute" | "share">("absolute");
  const [secondaryFilter, setSecondaryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultStatus ?? []);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** "primary" | "total" | a monthIso */
  const [sortKey, setSortKey] = useState<string>("total");
  const [desc, setDesc] = useState(true);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);

  const secondaryValues = useMemo(
    () => [...new Set(rows.map((r) => r.secondary).filter((v): v is string => !!v))].sort(),
    [rows],
  );
  const statusValues = useMemo(
    () => [...new Set(rows.map((r) => r.status).filter((v): v is string => !!v))].sort(),
    [rows],
  );

  const rowTotal = (r: MatrixRow) =>
    columns.reduce((acc, c) => acc + (r.byMonth.get(c.iso) ?? 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const haystack = [r.primary, r.secondary, ...Object.values(r.details ?? {})]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (secondaryValues.length > 0 && !matchesFilter(secondaryFilter, r.secondary)) return false;
      if (showStatus && statusValues.length > 0 && !matchesFilter(statusFilter, r.status)) {
        return false;
      }
      // Rows with nothing in the selected range are noise, not information.
      if (hideEmptyRows && rowTotal(r) === 0) return false;
      return true;
    });
  }, [rows, query, secondaryFilter, statusFilter, columns, hideEmptyRows, secondaryValues, statusValues, showStatus]);

  const sorted = useMemo(() => {
    const withTotals = filtered.map((r) => ({ row: r, total: rowTotal(r) }));
    withTotals.sort((a, b) => {
      let cmp: number;
      if (sortKey === "primary") cmp = a.row.primary.localeCompare(b.row.primary);
      else if (sortKey === "total") cmp = a.total - b.total;
      else cmp = (a.row.byMonth.get(sortKey) ?? 0) - (b.row.byMonth.get(sortKey) ?? 0);
      return desc ? -cmp : cmp;
    });
    return withTotals;
  }, [filtered, sortKey, desc, columns]);

  const columnTotals = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of columns) {
      out.set(
        c.iso,
        filtered.reduce((acc, r) => acc + (r.byMonth.get(c.iso) ?? 0), 0),
      );
    }
    return out;
  }, [filtered, columns]);

  const grandTotal = [...columnTotals.values()].reduce((a, b) => a + b, 0);

  const denomFor = (iso: string) =>
    shareDenominator ? (shareDenominator.get(iso) ?? 0) : (columnTotals.get(iso) ?? 0);

  const cellValue = (raw: number, iso: string) => {
    if (mode === "absolute") return raw;
    const d = denomFor(iso);
    return d === 0 ? 0 : raw / d;
  };

  const maxCell = useMemo(() => {
    let max = 0;
    for (const { row } of sorted) {
      for (const c of columns) {
        const v = Math.abs(cellValue(row.byMonth.get(c.iso) ?? 0, c.iso));
        if (v > max) max = v;
      }
    }
    return max;
  }, [sorted, columns, mode, shareDenominator, columnTotals]);

  const accentRgb = ACCENTS[accent];

  function toggleSort(key: string) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  function SortIcon({ active }: { active: boolean }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />;
  }

  // Sticky-left geometry. Primary, secondary and status are always visible;
  // detail columns appear between them only when details are open.
  type LeftCol = { id: string; label: string; width: number; kind: string };
  const leftCols: LeftCol[] = [{ id: "primary", label: primaryLabel, width: 190, kind: "primary" }];
  if (secondaryLabel) {
    leftCols.push({ id: "secondary", label: secondaryLabel, width: 140, kind: "secondary" });
  }
  if (showStatus) leftCols.push({ id: "status", label: "Status", width: 100, kind: "status" });
  if (detailsOpen) {
    for (const d of detailColumns) {
      leftCols.push({ id: d.key, label: d.label, width: d.width ?? 110, kind: "detail" });
    }
  }
  const offsets = leftCols.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + leftCols[i - 1].width);
    return acc;
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-56 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {secondaryLabel && secondaryValues.length > 1 && (
          <MultiSelectFilter
            eyebrow={filterLabel ?? secondaryLabel}
            options={secondaryValues}
            selected={secondaryFilter}
            onChange={setSecondaryFilter}
          />
        )}

        {showStatus && statusValues.length > 1 && (
          <MultiSelectFilter
            eyebrow={statusFilterLabel}
            width="w-52"
            options={statusValues}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        )}

        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-sm shadow-sm">
          {(
            [
              ["absolute", absoluteLabel],
              ["share", shareLabel],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {detailColumns.length > 0 && (
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
        )}

        <span className="ml-auto text-[11px] text-muted-foreground">
          {sorted.length} of {rows.length} · grand total{" "}
          {formatCurrency(grandTotal, { compact: true, currency })}
        </span>
      </div>

      <div
        className="max-h-[640px] overflow-auto rounded-xl border border-border/40"
        onMouseLeave={() => {
          setHoverRow(null);
          setHoverMonth(null);
        }}
      >
        <table className="w-max border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-30">
              {leftCols.map((c, i) => (
                <th
                  key={c.id}
                  onClick={c.kind === "primary" ? () => toggleSort("primary") : undefined}
                  className={cn(
                    "sticky z-30 sticky-bg whitespace-nowrap border-b border-border/40 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                    c.kind === "primary" && "cursor-pointer select-none",
                  )}
                  style={{ left: offsets[i], width: c.width, minWidth: c.width }}
                >
                  <div className="flex items-center gap-1">
                    {c.label}
                    {c.kind === "primary" && <SortIcon active={sortKey === "primary"} />}
                  </div>
                </th>
              ))}
              {columns.map((c) => (
                <th
                  key={c.iso}
                  onClick={() => toggleSort(c.iso)}
                  onMouseEnter={() => setHoverMonth(c.iso)}
                  className={cn(
                    "cursor-pointer select-none sticky-bg border-b border-border/40 px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide",
                    c.isForecast ? "italic text-muted-foreground/70" : "text-muted-foreground",
                    hoverMonth === c.iso && "text-foreground",
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    {c.label}
                    {c.isForecast && (
                      <span className="text-[8px] uppercase tracking-wider">fcst</span>
                    )}
                    <SortIcon active={sortKey === c.iso} />
                  </div>
                </th>
              ))}
              <th
                onClick={() => toggleSort("total")}
                className="cursor-pointer select-none sticky-bg border-b border-l border-border/40 px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                <div className="flex items-center justify-center gap-1">
                  {totalLabel}
                  <SortIcon active={sortKey === "total"} />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={leftCols.length + columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              sorted.map(({ row, total }) => {
                const rowActive = hoverRow === row.key;
                return (
                  <tr
                    key={row.key}
                    onMouseEnter={() => setHoverRow(row.key)}
                    className={cn("border-t border-border/30", rowActive && "bg-white/[0.05]")}
                  >
                    {leftCols.map((c, i) => (
                      <td
                        key={c.id}
                        className="sticky z-20 sticky-bg whitespace-nowrap px-3 py-2"
                        style={{ left: offsets[i], width: c.width, minWidth: c.width }}
                      >
                        {c.kind === "primary" && (
                          <span
                            className="block max-w-[180px] truncate text-sm font-medium"
                            title={row.primary}
                          >
                            {row.primary}
                          </span>
                        )}
                        {c.kind === "secondary" && (
                          <span
                            className="block max-w-[130px] truncate text-sm text-muted-foreground"
                            title={row.secondary}
                          >
                            {row.secondary ?? "—"}
                          </span>
                        )}
                        {c.kind === "status" && <StatusBadge status={row.status} />}
                        {c.kind === "detail" && (
                          <span
                            className="block truncate text-sm text-muted-foreground"
                            style={{ maxWidth: c.width - 16 }}
                            title={row.details?.[c.id]}
                          >
                            {row.details?.[c.id] || "—"}
                          </span>
                        )}
                      </td>
                    ))}

                    {columns.map((c) => {
                      const raw = row.byMonth.get(c.iso) ?? 0;
                      const value = cellValue(raw, c.iso);
                      const empty = raw === 0;
                      // A negative amount on a cost table is money coming back.
                      const inflow = signedValues && raw < 0;
                      const intensity =
                        maxCell === 0 ? 0 : Math.min(1, Math.abs(value) / maxCell);
                      const colActive = hoverMonth === c.iso;
                      return (
                        <td
                          key={c.iso}
                          onMouseEnter={() => {
                            setHoverRow(row.key);
                            setHoverMonth(c.iso);
                          }}
                          className={cn("px-1 py-1", colActive && "bg-white/[0.05]")}
                        >
                          <div
                            className="relative rounded-sm px-2 py-1"
                            style={
                              c.isForecast
                                ? {
                                    backgroundImage:
                                      "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 12px)",
                                  }
                                : undefined
                            }
                          >
                            <div
                              className="absolute inset-0 rounded-sm"
                              style={{
                                background: empty
                                  ? "transparent"
                                  : `rgba(${inflow ? INFLOW_RGB : accentRgb},${(c.isForecast ? 0.06 : 0.1) + intensity * (c.isForecast ? 0.3 : 0.62)})`,
                              }}
                            />
                            <div
                              className={cn(
                                "relative text-center text-[12px] tabular-nums",
                                c.isForecast && "italic text-foreground/85",
                                empty && "text-muted-foreground/40",
                                inflow && "font-semibold text-emerald-300",
                              )}
                            >
                              {empty
                                ? "—"
                                : mode === "absolute"
                                  ? formatCurrency(value, { compact: true, currency })
                                  : formatPercent(value, 1)}
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className="border-l border-border/40 px-3 py-2 text-center text-sm font-semibold tabular-nums">
                      {mode === "absolute"
                        ? formatCurrency(total, { compact: true, currency })
                        : grandTotal === 0
                          ? "—"
                          : formatPercent(total / grandTotal, 1)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot>
            <tr className="sticky bottom-0 z-30 border-t border-border/50">
              {leftCols.map((c, i) => (
                <td
                  key={c.id}
                  className="sticky z-30 sticky-bg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ left: offsets[i], width: c.width, minWidth: c.width }}
                >
                  {i === 0 ? totalLabel : ""}
                </td>
              ))}
              {columns.map((c) => {
                const t = columnTotals.get(c.iso) ?? 0;
                const shown =
                  mode === "absolute"
                    ? t === 0
                      ? "—"
                      : formatCurrency(t, { compact: true, currency })
                    : denomFor(c.iso) === 0
                      ? "—"
                      : formatPercent(t / denomFor(c.iso), 1);
                return (
                  <td
                    key={c.iso}
                    className={cn(
                      "sticky-bg px-3 py-2.5 text-center text-[12px] font-semibold tabular-nums",
                      c.isForecast && "italic text-muted-foreground",
                    )}
                  >
                    {shown}
                  </td>
                );
              })}
              <td className="sticky-bg border-l border-border/40 px-3 py-2.5 text-center text-sm font-bold tabular-nums">
                {mode === "absolute"
                  ? formatCurrency(grandTotal, { compact: true, currency })
                  : shareDenominator
                    ? "—"
                    : "100.0%"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
