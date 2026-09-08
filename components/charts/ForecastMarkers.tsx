"use client";

import { ReferenceArea, ReferenceLine } from "recharts";

/**
 * Forecast affordance shared by every time-series chart (formatting.md §2.A).
 * Returns null when nothing in view is forecast — Phase 1 draws no boundary.
 */
export function forecastMarkers({
  labels,
  firstForecastIndex,
  yAxisId,
  variant = "full",
}: {
  labels: string[];
  firstForecastIndex: number;
  yAxisId?: string;
  variant?: "full" | "line-only";
}) {
  if (firstForecastIndex < 0 || firstForecastIndex >= labels.length) return null;
  const firstLabel = labels[firstForecastIndex];
  const lastLabel = labels[labels.length - 1];

  const nodes = [];
  if (variant === "full") {
    nodes.push(
      <ReferenceArea
        key="fc-area"
        yAxisId={yAxisId}
        x1={firstLabel}
        x2={lastLabel}
        fill="rgba(255,255,255,0.04)"
        stroke="none"
        ifOverflow="visible"
      />,
      <ReferenceLine
        key="fc-line"
        yAxisId={yAxisId}
        x={firstLabel}
        stroke="rgba(255,255,255,0.35)"
        strokeDasharray="3 3"
        label={{
          value: "Forecast →",
          position: "insideTop",
          fill: "rgba(255,255,255,0.55)",
          fontSize: 10,
          fontWeight: 600,
        }}
      />,
    );
  } else {
    nodes.push(
      <ReferenceLine
        key="fc-line"
        yAxisId={yAxisId}
        x={firstLabel}
        stroke="rgba(120,120,120,0.4)"
        strokeDasharray="3 3"
      />,
    );
  }
  return nodes;
}
