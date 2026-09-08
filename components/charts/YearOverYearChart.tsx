"use client";

import { useState } from "react";
import {
  CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PopoverSelect } from "@/components/ui/PopoverSelect";
import {
  GRID_STROKE, LINE_TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE,
  formatCompact, formatLong, tickFormatterFor, yAxisWidthFor, type ValueKind,
} from "./chart-shared";

export type YoyMetric = {
  key: string;
  label: string;
  format: ValueKind;
  /** year → 12 values, Jan..Dec. Missing months are null. */
  byYear: Record<string, (number | null)[]>;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One metric, one line per year, normalised onto a shared Jan–Dec axis so the
 * years sit directly on top of each other rather than end to end.
 */
export function YearOverYearChart({
  metrics,
  years,
  height = 340,
}: {
  metrics: YoyMetric[];
  years: number[];
  height?: number;
}) {
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  if (!metric) return null;

  const rows = MONTHS.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const y of years) row[String(y)] = metric.byYear[String(y)]?.[i] ?? null;
    return row;
  });

  // One hue throughout. The current year is the full brand blue; earlier years
  // are the same blue dialled back, so the eye lands on this year first.
  // Same blue family throughout. The current year is the full brand blue; older
  // years step to progressively lighter blues, kept at high opacity so they stay
  // clearly readable rather than fading out.
  const RAMP = ["#bae6fd", "#7dd3fc", "#38bdf8", "#1390eb"];
  const ALPHA = [0.8, 0.9, 0.95, 1];
  const colors = years.map((_, i) => {
    const slot = RAMP.length - years.length + i;
    return RAMP[Math.max(0, slot)] ?? "#1390eb";
  });
  const alphas = years.map((_, i) => {
    const slot = ALPHA.length - years.length + i;
    return ALPHA[Math.max(0, slot)] ?? 1;
  });

  return (
    <div>
      <div className="relative">
        <div className="absolute left-0 top-0 z-10 flex flex-wrap items-center gap-2">
          <PopoverSelect
            eyebrow="Metric"
            width="w-60"
            options={metrics.map((m) => ({ value: m.key, label: m.label }))}
            value={metric.key}
            onChange={setMetricKey}
          />
          <span className="text-[11px] text-muted-foreground">
            shared Jan–Dec axis
          </span>
        </div>

        <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 54, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            padding={{ left: 12, right: 12 }}
            tick={{ fontSize: 11, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={yAxisWidthFor(metric.format)}
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickFormatterFor(metric.format)}
          />
          <Tooltip
            contentStyle={LINE_TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ stroke: "rgba(120,120,120,0.3)" }}
            formatter={(value, name) => [formatLong(Number(value), metric.format), name]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={9}
            wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "currentColor" }}
          />
          {years.map((y, i) => (
            <Line
              key={y}
              dataKey={String(y)}
              name={String(y)}
              stroke={colors[i]}
              strokeOpacity={alphas[i]}
              strokeWidth={i === years.length - 1 ? 3 : 2.25}
              dot={{ r: i === years.length - 1 ? 3 : 2.5, fill: colors[i], stroke: colors[i], strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            >
              <LabelList
                dataKey={String(y)}
                position="top"
                offset={9}
                fill={colors[i]}
                fontSize={i === years.length - 1 ? 11 : 10}
                fontWeight={i === years.length - 1 ? 700 : 600}
                formatter={(v: unknown) =>
                  v === null || v === undefined ? "" : formatCompact(Number(v), metric.format)
                }
              />
            </Line>
          ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
