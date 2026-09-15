"use client";

import { formatMetric, type Metric } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";
import { useState } from "react";

export type MetricColumn = { iso: string; label: string; isForecast: boolean };

/**
 * Metrics × months. Units differ per row (%, $, counts), so the heat scale is
 * normalised within each row rather than across the table.
 */
export function MetricMatrixTable({
  metrics,
  columns,
  currency = GBP_VIEW,
}: {
  metrics: Metric[];
  columns: MetricColumn[];
  currency?: CurrencyView;
}) {
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);

  return (
    <div
      className="max-h-[680px] overflow-auto rounded-xl border border-border/40"
      onMouseLeave={() => {
        setHoverRow(null);
        setHoverMonth(null);
      }}
    >
      <table className="w-max border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-30">
            <th
              className="sticky left-0 z-30 sticky-bg border-b border-border/40 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ width: 190, minWidth: 190 }}
            >
              Metric
            </th>
            {columns.map((c) => (
              <th
                key={c.iso}
                onMouseEnter={() => setHoverMonth(c.iso)}
                className={cn(
                  "sticky-bg border-b border-border/40 px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide",
                  c.isForecast ? "italic text-muted-foreground/70" : "text-muted-foreground",
                )}
              >
                {c.label}
                {c.isForecast && (
                  <span className="ml-1 text-[8px] uppercase tracking-wider">fcst</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            // Normalise per row so a percentage and a dollar row can share a table.
            const values = columns.map((c) => metric.byMonth.get(c.iso) ?? 0);
            const max = Math.max(...values.map(Math.abs), 0);
            const rowActive = hoverRow === metric.key;
            return (
              <tr
                key={metric.key}
                onMouseEnter={() => setHoverRow(metric.key)}
                className={cn("border-t border-border/30", rowActive && "bg-white/[0.05]")}
              >
                <td
                  className="sticky left-0 z-20 sticky-bg whitespace-nowrap px-3 py-2 text-sm font-medium"
                  style={{ width: 190, minWidth: 190 }}
                >
                  {metric.label}
                </td>
                {columns.map((c, i) => {
                  const value = values[i];
                  const empty = value === 0;
                  const intensity = max === 0 ? 0 : Math.min(1, Math.abs(value) / max);
                  const colActive = hoverMonth === c.iso;
                  return (
                    <td
                      key={c.iso}
                      onMouseEnter={() => {
                        setHoverRow(metric.key);
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
                              : `rgba(34,211,238,${(c.isForecast ? 0.05 : 0.08) + intensity * (c.isForecast ? 0.25 : 0.5)})`,
                          }}
                        />
                        <div
                          className={cn(
                            "relative min-w-[64px] text-center text-[12px] tabular-nums",
                            c.isForecast && "italic text-foreground/85",
                            empty && "text-muted-foreground/40",
                          )}
                        >
                          {empty ? "—" : formatMetric(value, metric.format, currency)}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
