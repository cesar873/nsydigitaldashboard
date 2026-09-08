"use client";

import {
  Area, CartesianGrid, ComposedChart, LabelList, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
  formatCompact, formatLong, lighten, tickFormatterFor, yAxisWidthFor, type ValueKind,
} from "./chart-shared";
import { forecastMarkers } from "./ForecastMarkers";

export type PlanVsActualDatum = {
  label: string;
  actualCum: number;
  planCum: number;
  isActual: boolean;
};

const ACTUAL = "#1390eb";
const PLAN = "#22c55e";

/**
 * Cumulative actual against cumulative plan across the range. The gap between
 * the two curves is the story: actual above plan is surplus, below is the hole.
 *
 * The plan runs the FULL range — it is a target, known for every month. Only
 * the actual series splits at the last actual month, continuing as a lighter
 * dashed tint for the run-rate forecast.
 */
export function PlanVsActualChart({
  data,
  format = "currency",
  height = 340,
  actualName = "Actual",
  planName = "Plan",
}: {
  data: PlanVsActualDatum[];
  format?: ValueKind;
  height?: number;
  actualName?: string;
  planName?: string;
}) {
  const firstForecastIndex = data.findIndex((d) => !d.isActual);
  const actualTint = lighten(ACTUAL);

  /** Renders one series' labels, pushed above or below per point. */
  const labelFor = (key: "planCum" | "actualCum", color: string) =>
    function PositionedLabel(props: unknown) {
      const { x, y, index, value } = props as {
        x: number; y: number; index: number; value: number | null;
      };
      if (value === null || !Number.isFinite(value)) return null;
      const point = data[index];
      if (!point) return null;
      const mine = key === "planCum" ? point.planCum : point.actualCum;
      const other = key === "planCum" ? point.actualCum : point.planCum;
      // Ties push plan up and actual down so the two never collide.
      const onTop = mine > other || (mine === other && key === "planCum");
      return (
        <text
          x={x}
          y={y + (onTop ? -12 : 18)}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontWeight={600}
        >
          {formatCompact(value, format)}
        </text>
      );
    };

  const rows = data.map((d, i) => {
    const isForecast = firstForecastIndex >= 0 && i >= firstForecastIndex;
    const isBoundary = firstForecastIndex >= 0 && i === firstForecastIndex - 1;
    return {
      ...d,
      actual: isForecast ? null : d.actualCum,
      actualFc: isForecast || isBoundary ? d.actualCum : null,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 30, right: 42, bottom: 22, left: 12 }}>
        <defs>
          <linearGradient id="pva-actual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACTUAL} stopOpacity={0.45} />
            <stop offset="100%" stopColor={ACTUAL} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="pva-plan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PLAN} stopOpacity={0.22} />
            <stop offset="100%" stopColor={PLAN} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          // Keeps the first and last month labels clear of the plot edges.
          padding={{ left: 18, right: 18 }}
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
          cursor={{ stroke: "rgba(120,120,120,0.3)" }}
          formatter={(value, name) => [formatLong(Number(value), format), name]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ paddingBottom: 8, fontSize: 11, color: "currentColor" }}
          payload={[
            { value: planName, type: "circle" as const, color: PLAN },
            { value: actualName, type: "circle" as const, color: ACTUAL },
            ...(firstForecastIndex >= 0
              ? [{ value: `${actualName} (Services)`, type: "circle" as const, color: actualTint }]
              : []),
          ]}
        />
        {forecastMarkers({ labels: rows.map((d) => d.label), firstForecastIndex })}

        {/* Plan spans the whole range — it is a target, not an observation. */}
        <Area
          dataKey="planCum"
          name={planName}
          type="monotone"
          stroke={PLAN}
          strokeWidth={2}
          strokeDasharray="4 3"
          fill="url(#pva-plan)"
          dot={false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        >
          <LabelList dataKey="planCum" content={labelFor("planCum", PLAN)} />
        </Area>

        <Area
          dataKey="actual"
          name={actualName}
          type="monotone"
          stroke={ACTUAL}
          strokeWidth={2.5}
          fill="url(#pva-actual)"
          dot={{ r: 2.5, fill: ACTUAL, stroke: ACTUAL, strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          connectNulls={false}
        >
          <LabelList dataKey="actual" content={labelFor("actualCum", ACTUAL)} />
        </Area>

        {firstForecastIndex >= 0 && (
          <Area
            dataKey="actualFc"
            name={`${actualName} (Services)`}
            legendType="none"
            type="monotone"
            stroke={actualTint}
            strokeWidth={2.5}
            strokeDasharray="5 4"
            fill="none"
            dot={{ r: 2.5, fill: actualTint, stroke: actualTint, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls={false}
          >
            <LabelList dataKey="actualFc" content={labelFor("actualCum", actualTint)} />
          </Area>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
