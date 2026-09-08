"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientProfitRow } from "@/lib/sources/client-profit";
import { MultiSelectFilter, matchesFilter } from "@/components/ui/MultiSelectFilter";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SortKey = "client" | "revenue" | "peopleCost" | "profit" | "margin";

/** Value on the left, proportional bar on the right (formatting.md §3.7.b). */
function BarCell({
  value,
  max,
  color,
  mutedWhenZero = true,
}: {
  value: number;
  max: number;
  color: string;
  mutedWhenZero?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 text-right text-[13px] tabular-nums">
        {value === 0 && mutedWhenZero ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCurrency(value, { compact: true })
        )}
      </span>
      <span className="h-1.5 w-16 rounded bg-muted/40">
        <span className={cn("block h-1.5 rounded", color)} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function ClientProfitTable({ rows }: { rows: ClientProfitRow[] }) {
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [intensities, setIntensities] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [desc, setDesc] = useState(true);

  const serviceOptions = useMemo(
    () => [...new Set(rows.map((r) => r.service).filter(Boolean))].sort(),
    [rows],
  );
  const intensityOptions = useMemo(
    () => [...new Set(rows.map((r) => r.intensity).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.client.toLowerCase().includes(q)) return false;
      if (serviceOptions.length > 0 && !matchesFilter(services, r.service)) return false;
      if (intensityOptions.length > 0 && !matchesFilter(intensities, r.intensity)) return false;
      return true;
    });
  }, [rows, query, services, intensities, serviceOptions, intensityOptions]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === "client") cmp = a.client.localeCompare(b.client);
      else if (sortKey === "margin") cmp = (a.margin ?? 0) - (b.margin ?? 0);
      else cmp = a[sortKey] - b[sortKey];
      return desc ? -cmp : cmp;
    });
    return out;
  }, [filtered, sortKey, desc]);

  const max = {
    revenue: Math.max(...rows.map((r) => r.revenue), 0),
    peopleCost: Math.max(...rows.map((r) => r.peopleCost), 0),
    referralFees: Math.max(...rows.map((r) => r.referralFees), 0),
    otherCosts: Math.max(...rows.map((r) => r.otherCosts + r.acquisitionCost), 0),
    profit: Math.max(...rows.map((r) => Math.abs(r.profit)), 0),
  };

  const totals = sorted.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      peopleCost: acc.peopleCost + r.peopleCost,
      referralFees: acc.referralFees + r.referralFees,
      otherCosts: acc.otherCosts + r.otherCosts + r.acquisitionCost,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, peopleCost: 0, referralFees: 0, otherCosts: 0, profit: 0 },
  );
  const totalMargin = totals.revenue !== 0 ? totals.profit / totals.revenue : null;

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  function SortableTh({
    label,
    sortBy,
    align = "left",
  }: {
    label: string;
    sortBy?: SortKey;
    align?: "left" | "right";
  }) {
    const active = sortBy === sortKey;
    return (
      <th
        onClick={sortBy ? () => toggleSort(sortBy) : undefined}
        className={cn(
          "sticky-bg border-b border-border/40 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
          align === "right" ? "text-right" : "text-left",
          sortBy && "cursor-pointer select-none",
        )}
      >
        <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
          {label}
          {sortBy &&
            (active ? (
              desc ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <ArrowUp className="h-3 w-3" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            ))}
        </div>
      </th>
    );
  }

  function marginTone(m: number | null) {
    if (m === null) return "bg-muted/30 text-muted-foreground";
    if (m >= 0.6) return "bg-emerald-500/15 text-emerald-300";
    if (m >= 0.4) return "bg-amber-500/15 text-amber-300";
    if (m > 0) return "bg-rose-500/15 text-rose-300";
    return "bg-rose-500/25 text-rose-200";
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client name…"
          className="w-56 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {serviceOptions.length > 1 && (
          <MultiSelectFilter
            eyebrow="Service"
            options={serviceOptions}
            selected={services}
            onChange={setServices}
          />
        )}
        {intensityOptions.length > 1 && (
          <MultiSelectFilter
            eyebrow="Intensity"
            width="w-48"
            options={intensityOptions}
            selected={intensities}
            onChange={setIntensities}
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
              <SortableTh label="Client" sortBy="client" />
              <SortableTh label="Service" />
              <SortableTh label="Intensity" />
              <SortableTh label="Team" />
              <SortableTh label="Revenue" sortBy="revenue" />
              <SortableTh label="People cost" sortBy="peopleCost" />
              <SortableTh label="Referral fees" />
              <SortableTh label="Other costs" />
              <SortableTh label="Client profit" sortBy="profit" />
              <SortableTh label="Margin" sortBy="margin" align="right" />
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No clients match the current filters.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr
                  key={`${r.client}-${r.service}-${i}`}
                  className="border-t border-border/30 hover:bg-white/[0.06]"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="block max-w-[180px] truncate font-medium" title={r.client}>
                      {r.client}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[13px] text-muted-foreground whitespace-nowrap">
                    {r.service || "—"}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-muted-foreground whitespace-nowrap">
                    {r.intensity || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="text-[12px] text-sky-300"
                      title={r.teamMembers.join(", ") || undefined}
                    >
                      {r.teamMembers.length > 0
                        ? `${r.teamMembers.length} member${r.teamMembers.length === 1 ? "" : "s"}`
                        : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <BarCell value={r.revenue} max={max.revenue} color="bg-sky-500/70" />
                  </td>
                  <td className="px-3 py-2">
                    <BarCell value={r.peopleCost} max={max.peopleCost} color="bg-rose-500/70" />
                  </td>
                  <td className="px-3 py-2">
                    <BarCell value={r.referralFees} max={max.referralFees} color="bg-amber-500/70" />
                  </td>
                  <td className="px-3 py-2">
                    <BarCell
                      value={r.otherCosts + r.acquisitionCost}
                      max={max.otherCosts}
                      color="bg-orange-500/70"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <BarCell
                      value={r.profit}
                      max={max.profit}
                      color={r.profit < 0 ? "bg-rose-500/70" : "bg-emerald-500/70"}
                      mutedWhenZero={false}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                        marginTone(r.margin),
                      )}
                    >
                      {r.margin === null ? "—" : formatPercent(r.margin)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr className="sticky bottom-0 z-30 sticky-bg border-t border-border/50">
              <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide" colSpan={4}>
                Grand total
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.revenue, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.peopleCost, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.referralFees, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                {formatCurrency(totals.otherCosts, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-bold tabular-nums">
                {formatCurrency(totals.profit, { compact: true })}
              </td>
              <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums">
                {totalMargin === null ? "—" : formatPercent(totalMargin)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
