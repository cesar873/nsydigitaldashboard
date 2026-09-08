"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
  formatCompact, formatLong, lighten, tickFormatterFor, yAxisWidthFor, type ValueKind,
} from "./chart-shared";
import { forecastMarkers } from "./ForecastMarkers";

export type MonthBarDatum = { label: string; value: number; isForecast: boolean };

/** One metric per month. Forecast months render in light grey. */
export function SingleBarChart({
  data,
  color,
  format = "currency",
  height = 280,
  name = "Value",
}: {
  data: MonthBarDatum[];
  color: string;
  format?: ValueKind;
  height?: number;
  name?: string;
}) {
  const firstForecastIndex = data.findIndex((d) => d.isForecast);
  const tint = lighten(color);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 28, right: 16, bottom: 4, left: 8 }}>
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
          tickFormatter={tickFormatterFor(format)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
          formatter={(value) => [formatLong(Number(value), format), name]}
        />
        {forecastMarkers({ labels: data.map((d) => d.label), firstForecastIndex })}
        <Bar dataKey="value" name={name} barSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.isForecast ? tint : color}
              fillOpacity={d.isForecast ? 0.75 : 0.88}
            />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            offset={8}
            formatter={(v: unknown) => (Number(v) === 0 ? "" : formatCompact(Number(v), format))}
            fontSize={10}
            fontWeight={600}
            fill="currentColor"
            content={(props) => {
              const { x, y, width, index, value } = props as unknown as {
                x: number; y: number; width: number; index: number; value: number;
              };
              if (!Number.isFinite(value) || value === 0) return null;
              const forecast = data[index]?.isForecast;
              return (
                <text
                  x={x + width / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill={forecast ? tint : "currentColor"}
                  fontSize={10}
                  fontWeight={600}
                >
                  {formatCompact(value, format)}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
