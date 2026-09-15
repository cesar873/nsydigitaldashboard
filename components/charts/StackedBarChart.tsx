"use client";

import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CHART_MARGIN, GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
  PALETTE_BLUE, PALETTE_RED, formatCompact, formatLong, spacedPalette,
  tickFormatterFor, yAxisWidthFor, type ValueKind,
} from "./chart-shared";
import { forecastMarkers } from "./ForecastMarkers";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export type StackSeries = { key: string; name: string; color?: string };

export function StackedBarChart({
  data,
  series,
  height = 320,
  format = "currency",
  paletteSort,
  firstForecastIndex = -1,
  currency = GBP_VIEW,
}: {
  data: Record<string, string | number>[];
  series: StackSeries[];
  height?: number;
  format?: ValueKind;
  paletteSort?: "blue" | "red";
  firstForecastIndex?: number;
  currency?: CurrencyView;
}) {
  // Drop series that are zero in every month.
  const active = series.filter((s) => data.some((d) => Number(d[s.key] ?? 0) !== 0));

  // paletteSort: biggest series → bottom of stack → darkest color (§4.5).
  let ordered = active;
  if (paletteSort) {
    const totals = new Map(
      active.map((s) => [s.key, data.reduce((acc, d) => acc + Number(d[s.key] ?? 0), 0)]),
    );
    ordered = [...active].sort((a, b) => (totals.get(b.key) ?? 0) - (totals.get(a.key) ?? 0));
    const colors = spacedPalette(
      paletteSort === "blue" ? PALETTE_BLUE : PALETTE_RED,
      ordered.length,
    );
    ordered = ordered.map((s, i) => ({ ...s, color: colors[i] }));
  }

  const rows: Record<string, string | number>[] = data.map((d) => ({
    ...d,
    __total: ordered.reduce((acc, s) => acc + Number(d[s.key] ?? 0), 0),
  }));
  const labels = rows.map((d) => String(d.label));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={CHART_MARGIN}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: 11, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={yAxisWidthFor(format)}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatterFor(format, currency)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
          formatter={(value, name) => [formatLong(Number(value), format, currency), name]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ paddingBottom: 8, fontSize: 11, color: "currentColor" }}
          payload={ordered.map((s) => ({
            value: s.name,
            type: "circle" as const,
            color: s.color ?? "#1390eb",
          }))}
        />
        {forecastMarkers({ labels, firstForecastIndex })}
        {ordered.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="1"
            barSize={28}
            fill={s.color ?? "#1390eb"}
            isAnimationActive={false}
            radius={i === ordered.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          >
            {rows.map((_, idx) => (
              <Cell
                key={idx}
                fillOpacity={
                  firstForecastIndex >= 0 && idx >= firstForecastIndex ? 0.42 : 0.88
                }
              />
            ))}
          </Bar>
        ))}
        {/* Invisible line carries the stack total label above the tallest bar. */}
        <Line
          dataKey="__total"
          type="monotone"
          stroke="transparent"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          legendType="none"
        >
          <LabelList
            dataKey="__total"
            position="top"
            offset={10}
            formatter={(v: unknown) => formatCompact(Number(v), format, currency)}
            style={{ fill: "currentColor", fontSize: 11, fontWeight: 600 }}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
