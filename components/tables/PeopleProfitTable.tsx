"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { TeamProfitRow } from "@/lib/sources/team-profit";
import { MultiSelectFilter, matchesFilter } from "@/components/ui/MultiSelectFilter";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SortKey = "name" | "hoursAvailable" | "revenueCovered" | "profit" | "utilizationActual" | "revenueGap";

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 text-right text-[13px] tabular-nums">
        {value === 0 ? <span className="text-muted-foreground">—</span> : formatCurrency(value, { compact: true })}
      </span>
      <span className="h-1.5 w-16 rounded bg-muted/40">
        <span className={cn("block h-1.5 rounded", color)} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** Utilisation bar with a tick marking the person's target. */
function UtilizationCell({ actual, target }: { actual: number | null; target: number | null }) {
  if (actual === null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.min(100, actual * 100);
  const tone = actual >= 0.9 ? "bg-emerald-500/70" : actual >= 0.5 ? "bg-amber-500/70" : "bg-rose-500/70";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 text-right text-[13px] tabular-nums">{formatPercent(actual, 0)}</span>
      <span className="relative h-1.5 w-16 rounded bg-muted/40">
        <span className={cn("block h-1.5 rounded", tone)} style={{ width: `${pct}%` }} />
        {target !== null && (
          <span
            className="absolute top-0 h-1.5 w-px bg-foreground/70"
            style={{ left: `${Math.min(100, target * 100)}%` }}
            title={`Target ${formatPercent(target, 0)}`}
          />
        )}
      </span>
    </div>
  );
}

export function PeopleProfitTable({ rows }: { rows: TeamProfitRow[] }) {
  const [query, setQuery] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("revenueCovered");
  const [desc, setDesc] = useState(true);

  const deptOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (deptOptions.length > 0 && !matchesFilter(departments, r.department)) return false;
      return true;
    });
  }, [rows, query, departments, deptOptions]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "utilizationActual") cmp = (a.utilizationActual ?? 0) - (b.utilizationActual ?? 0);
      else cmp = a[sortKey] - b[sortKey];
      return desc ? -cmp : cmp;
    });
    return out;
  }, [filtered, sortKey, desc]);

  const max = {
    hours: Math.max(...rows.map((r) => r.hoursAvailable), 0),
    covered: Math.max(...rows.map((r) => r.revenueCovered), 0),
    profit: Math.max(...rows.map((r) => Math.abs(r.profit)), 0),
    gap: Math.max(...rows.map((r) => Math.abs(r.revenueGap)), 0),
  };

  const totals = sorted.reduce(
    (a, r) => ({
      hours: a.hours + r.hoursAvailable,
      covered: a.covered + r.revenueCovered,
      profit: a.profit + r.profit,
      gap: a.gap + Math.max(0, r.revenueGap),
    }),
    { hours: 0, covered: 0, profit: 0, gap: 0 },
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  function SortableTh({ label, sortBy }: { label: string; sortBy?: SortKey }) {
    const active = sortBy === sortKey;
    return (
      <th
        onClick={sortBy ? () => toggleSort(sortBy) : undefined}
        className={cn(
          "sticky-bg border-b border-border/40 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
          sortBy && "cursor-pointer select-none",
        )}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortBy &&
            (active ? (
              desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            ))}
        </div>
      </th>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team member…"
          className="w-56 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {deptOptions.length > 1 && (
          <MultiSelectFilter
            eyebrow="Department"
            options={deptOptions}
            selected={departments}
            onChange={setDepartments}
          />
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          Showing {sorted.length} of {rows.length}
        </span>
      </div>

      <div className="max-h-[640px] overflow-auto rounded-xl border border-border/40">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-30">
              <SortableTh label="Team member" sortBy="name" />
              <SortableTh label="Department" />
              <SortableTh label="Cost / hr" />
              <SortableTh label="Hours available" sortBy="hoursAvailable" />
              <SortableTh label="Revenue covered" sortBy="revenueCovered" />
              <SortableTh label="Profit" sortBy="profit" />
              <SortableTh label="Utilization" sortBy="utilizationActual" />
              <SortableTh label="vs Target" />
              <SortableTh label="Revenue gap" sortBy="revenueGap" />
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No team members match the current filters.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => {
                const vsTargetPp =
                  r.utilizationActual !== null && r.utilizationTarget !== null
                    ? (r.utilizationActual - r.utilizationTarget) * 100
                    : null;
                return (
                  <tr key={`${r.name}-${i}`} className="border-t border-border/30 hover:bg-white/[0.06]">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="block max-w-[180px] truncate font-medium" title={r.name}>
                        {r.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[13px] text-muted-foreground whitespace-nowrap">
                      {r.department || "—"}
                    </td>
                    <td className="px-3 py-2 text-[13px] tabular-nums whitespace-nowrap">
                      {r.costPerHour === 0 ? "—" : formatCurrency(r.costPerHour)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-12 text-right text-[13px] tabular-nums">
                          {r.hoursAvailable === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatNumber(r.hoursAvailable, 1)
                          )}
                        </span>
                        <span className="h-1.5 w-16 rounded bg-muted/40">
                          <span
                            className="block h-1.5 rounded bg-sky-500/70"
                            style={{ width: `${max.hours > 0 ? (r.hoursAvailable / max.hours) * 100 : 0}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <BarCell value={r.revenueCovered} max={max.covered} color="bg-emerald-500/70" />
                    </td>
                    <td className="px-3 py-2">
                      <BarCell
                        value={r.profit}
                        max={max.profit}
                        color={r.profit < 0 ? "bg-rose-500/70" : "bg-emerald-500/70"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <UtilizationCell actual={r.utilizationActual} target={r.utilizationTarget} />
                    </td>
                    <td className="px-3 py-2">
                      {vsTargetPp === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                            vsTargetPp >= 0
                              ? "bg-emerald-500/15 text-emerald-300"
                              : vsTargetPp >= -10
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-rose-500/15 text-rose-300",
                          )}
                        >
                          {vsTargetPp > 0 ? "+" : ""}
                          {vsTargetPp.toFixed(0)} pp
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <BarCell
                        value={r.revenueGap}
                        max={max.gap}
                        color={r.revenueGap > 0 ? "bg-rose-500/70" : "bg-emerald-500/70"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot>
            <tr className="sticky bottom-0 z-30 sticky-bg border-t border-border/50">
              <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide" colSpan={3}>
                Grand total
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatNumber(totals.hours, 0)}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.covered, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-bold tabular-nums">
                {formatCurrency(totals.profit, { compact: true })}
              </td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.gap, { compact: true })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
