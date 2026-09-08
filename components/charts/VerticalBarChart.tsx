"use client";

import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
  formatCompact, formatLong, tickFormatterFor, yAxisWidthFor, type ValueKind,
} from "./chart-shared";

export function VerticalBarChart({
  data,
  format = "currency",
  color = "#1390eb",
  height = 280,
}: {
  data: { name: string; value: number }[];
  format?: ValueKind;
  color?: string;
  height?: number;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} margin={{ top: 28, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={yAxisWidthFor(format)}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatterFor(format)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
          formatter={(value) => [formatLong(Number(value), format), "Value"]}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          barSize={36}
          fill={color}
          fillOpacity={0.85}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="top"
            offset={6}
            formatter={(v: unknown) => formatCompact(Number(v), format)}
            style={{ fill: "currentColor", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
