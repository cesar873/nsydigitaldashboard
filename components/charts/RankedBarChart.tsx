"use client";

import {
  Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
  formatCompact, formatLong, tickFormatterFor, type ValueKind,
} from "./chart-shared";

import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export type RankedDatum = { name: string; value: number };

export function RankedBarChart({
  data,
  format = "currency",
  color = "#1390eb",
  maxRows = 20,
  currency = GBP_VIEW,
}: {
  data: RankedDatum[];
  format?: ValueKind;
  color?: string;
  maxRows?: number;
  currency?: CurrencyView;
}) {
  const sorted = [...data]
    .filter((d) => Number.isFinite(d.value) && d.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, maxRows);

  const maxVal = Math.max(...sorted.map((d) => d.value), 0);
  const longest = sorted.reduce((m, d) => Math.max(m, d.name.length), 0);
  const yWidth = Math.min(180, Math.max(60, longest * 7));
  const height = Math.max(260, sorted.length * 28 + 24);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 8, right: 56, bottom: 4, left: 4 }}
      >
        <XAxis
          type="number"
          domain={[0, maxVal * 1.1]}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatterFor(format, currency)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          interval={0}
          tick={{ fontSize: 11, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
          formatter={(value) => [formatLong(Number(value), format, currency), "Value"]}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          barSize={16}
          fill={color}
          fillOpacity={0.85}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => formatCompact(Number(v), format, currency)}
            style={{ fill: "currentColor", fontSize: 11, fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
