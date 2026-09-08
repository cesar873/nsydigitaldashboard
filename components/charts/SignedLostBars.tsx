"use client";

import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE, lighten,
} from "./chart-shared";
import { forecastMarkers } from "./ForecastMarkers";
import { useDrillDown } from "@/components/ui/DrillDown";

export type SignedLostDatum = {
  label: string;
  signed: number;
  lost: number;
  total: number;
  isForecast: boolean;
  /** ISO month, so a clicked bar can resolve to the underlying clients. */
  monthIso: string;
};

const SIGNED = "#22c55e";
const LOST = "#ef4444";
const TOTAL = "#1390eb";

/**
 * Monthly signs and losses as paired bars, with total clients on a right axis.
 * Net movement reads as the gap between the two bars (formatting.md §2.B.12).
 */
export function SignedLostBars({
  data,
  height = 320,
  clickable = true,
}: {
  data: SignedLostDatum[];
  height?: number;
  clickable?: boolean;
}) {
  const firstForecastIndex = data.findIndex((d) => d.isForecast);
  const drilldown = useDrillDown();

  const onBar = (dimension: "clientsSigned" | "clientsLost") =>
    clickable && drilldown
      ? (payload: { monthIso?: string }) => {
          if (!payload?.monthIso) return;
          drilldown.open({ dimension, months: [payload.monthIso] });
        }
      : undefined;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 28, right: 16, bottom: 4, left: 8 }}>
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
          yAxisId="bars"
          width={30}
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="total"
          orientation="right"
          width={36}
          allowDecimals={false}
          domain={[0, "dataMax + 5"]}
          tick={{ fontSize: 10, fill: "currentColor" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ paddingBottom: 8, fontSize: 11, color: "currentColor" }}
        />
        {forecastMarkers({
          labels: data.map((d) => d.label),
          firstForecastIndex,
          yAxisId: "bars",
        })}

        <Bar
          yAxisId="bars"
          dataKey="signed"
          name="Signed"
          barSize={14}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
          cursor={clickable ? "pointer" : undefined}
          onClick={onBar("clientsSigned")}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.isForecast ? lighten(SIGNED) : SIGNED} fillOpacity={d.isForecast ? 0.7 : 1} />
          ))}
          <LabelList
            dataKey="signed"
            position="top"
            formatter={(v: unknown) => (Number(v) === 0 ? "" : String(v))}
            fill="currentColor"
            fontSize={11}
            fontWeight={700}
          />
        </Bar>

        <Bar
          yAxisId="bars"
          dataKey="lost"
          name="Lost"
          barSize={14}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
          cursor={clickable ? "pointer" : undefined}
          onClick={onBar("clientsLost")}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.isForecast ? lighten(LOST) : LOST} fillOpacity={d.isForecast ? 0.7 : 1} />
          ))}
          <LabelList
            dataKey="lost"
            position="top"
            formatter={(v: unknown) => (Number(v) === 0 ? "" : String(v))}
            fill="currentColor"
            fontSize={10}
            fontWeight={600}
          />
        </Bar>

        <Line
          yAxisId="total"
          dataKey="total"
          name="Total clients"
          type="monotone"
          stroke={TOTAL}
          strokeWidth={2}
          dot={{ r: 3, fill: TOTAL, stroke: TOTAL, strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="total"
            position="top"
            offset={12}
            fill="currentColor"
            fontSize={11}
            fontWeight={700}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
