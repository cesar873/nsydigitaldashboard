import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

/**
 * Metric types and formatting, deliberately free of any sheet/server imports so
 * client components can use them without pulling google-auth-library into the
 * browser bundle.
 */
export type MetricFormat = "currency" | "percent" | "number" | "ratio";

export type Metric = {
  key: string;
  label: string;
  format: MetricFormat;
  /** Lower is better — flips delta colouring. */
  inverse?: boolean;
  byMonth: Map<string, number>;
};

export function formatMetric(value: number, format: MetricFormat): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return formatCurrency(value, { compact: true });
    case "percent":
      return formatPercent(value, 1);
    case "ratio":
      return `${value.toFixed(1)}:1`;
    default:
      return formatNumber(value, Number.isInteger(value) ? 0 : 1);
  }
}
