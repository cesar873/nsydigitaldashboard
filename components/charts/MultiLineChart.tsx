"use client";

import {
  CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  CHART_MARGIN, GRID_STROKE, LINE_TOOLTIP_STYLE,
  TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE,
  formatCompact, formatLong, lighten, splitForecast, tickFormatterFor, yAxisWidthFor,
  type ValueKind,
} from "./chart-shared";
import { forecastMarkers } from "./ForecastMarkers";

export type LineSeries = {
  key: string;
  name: string;
  color: string;
  format: ValueKind;
  axis?: "left" | "right";
  /** Which side of the line its data labels sit on. Defaults to "top". */
  labelPosition?: "top" | "bottom";
};

export function MultiLineChart({
  data,
  series,
  height = 320,
  leftFormat = "currency",
  rightFormat = "number",
  firstForecastIndex = -1,
}: {
  data: Record<string, string | number>[];
  series: LineSeries[];
  height?: number;
  leftFormat?: ValueKind;
  rightFormat?: ValueKind;
  firstForecastIndex?: number;
}) {
  const hasRight = series.some((s) => s.axis === "right");
  const labels = data.map((d) => String(d.label));
  const rows = splitForecast(
    data,
    series.map((s) => s.key),
    firstForecastIndex,
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 28, right: 16, bottom: 20, left: 8 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          width={yAxisWidthFor(leftFormat)}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatterFor(leftFormat)}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={48}
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickFormatterFor(rightFormat)}
          />
        )}
        <Tooltip
          contentStyle={LINE_TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ stroke: "rgba(120,120,120,0.3)" }}
          formatter={(value, name) => {
            const s = series.find((x) => x.name === name);
            return [formatLong(Number(value), s?.format ?? "currency"), name];
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingBottom: 8, fontSize: 11, color: "currentColor" }}
          payload={series.map((s) => ({
            value: s.name,
            type: "circle" as const,
            color: s.color,
          }))}
        />
        {forecastMarkers({ labels, firstForecastIndex, yAxisId: "left" })}
        {series.map((s, i) => (
          <Line
            key={s.key}
            yAxisId={s.axis === "right" ? "right" : "left"}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, stroke: s.color, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls={false}
          >
            <LabelList
              dataKey={s.key}
              position={s.labelPosition ?? "top"}
              offset={s.labelPosition ? 12 : 10 + i * 14}
              formatter={(v: unknown) => formatCompact(Number(v), s.format)}
              fill="currentColor"
              fontSize={11}
              fontWeight={600}
            />
          </Line>
        ))}
        {/* Forecast tail of each series, in light grey. */}
        {firstForecastIndex >= 0 &&
          series.map((s, i) => {
            const tint = lighten(s.color);
            return (
              <Line
                key={`${s.key}__fc`}
                yAxisId={s.axis === "right" ? "right" : "left"}
                dataKey={`${s.key}__fc`}
                name={`${s.name} (forecast)`}
                legendType="none"
                stroke={tint}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: tint, stroke: tint, strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls={false}
              >
                <LabelList
                  dataKey={`${s.key}__fc`}
                  position={s.labelPosition ?? "top"}
                  offset={s.labelPosition ? 12 : 10 + i * 14}
                  formatter={(v: unknown) => formatCompact(Number(v), s.format)}
                  fill={tint}
                  fontSize={11}
                  fontWeight={600}
                />
              </Line>
            );
          })}
      </LineChart>
    </ResponsiveContainer>
  );
}
