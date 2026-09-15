import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export const DATA_LABEL_STYLE = {
  fill: "currentColor",
  fontSize: 11,
  fontWeight: 600 as const,
};

export const TOOLTIP_STYLE = {
  background: "var(--popover, oklch(0.18 0 0))",
  border: "1px solid var(--border, rgb(60 60 70))",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 12,
  color: "var(--popover-foreground, white)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

export const TOOLTIP_LABEL_STYLE = {
  color: "var(--popover-foreground, white)",
  fontWeight: 600 as const,
  marginBottom: 4,
};

export const TOOLTIP_ITEM_STYLE = {
  color: "var(--popover-foreground, white)",
};

export const LINE_TOOLTIP_STYLE = {
  background: "var(--popover, oklch(0.18 0 0))",
  border: "1px solid var(--border, rgb(60 60 70))",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground, white)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

export const CHART_MARGIN = { top: 28, right: 16, bottom: 4, left: 8 };
export const GRID_STROKE = "rgba(120,120,120,0.12)";

export const PALETTE_BLUE = [
  "#0369a1", "#0284c7", "#0ea5e9", "#1390eb",
  "#38bdf8", "#7dd3fc", "#bae6fd", "#dbeafe",
];

export const PALETTE_RED = [
  "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2",
];

export const FUNNEL = ["#7dd3fc", "#38bdf8", "#1390eb", "#0c6ec3", "#0a4f8c"];

/**
 * Forecast months render as a lighter tint of the series' own colour, so the
 * series stays identifiable while actuals remain visually dominant.
 */
export function lighten(hex: string, ratio = 0.55): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Splits a series into an actuals key and a forecast key. The boundary point is
 * duplicated into both so the two segments join without a visible gap.
 */
export function splitForecast<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  firstForecastIndex: number,
): (T & Record<string, number | null>)[] {
  return rows.map((row, i) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of keys) {
      const value = row[key] as number | undefined;
      if (firstForecastIndex < 0) {
        out[`${key}__fc`] = null;
        continue;
      }
      const isForecast = i >= firstForecastIndex;
      const isBoundary = i === firstForecastIndex - 1;
      out[key] = isForecast ? null : (value ?? null);
      out[`${key}__fc`] = isForecast || isBoundary ? (value ?? null) : null;
    }
    return out as T & Record<string, number | null>;
  });
}

export type ValueKind = "currency" | "percent" | "number";

/**
 * Currency values arrive in the base currency (GBP). Passing the active
 * `CurrencyView` converts (× rate) and swaps the symbol; omitting it renders
 * the base currency. Non-currency kinds ignore it.
 */
export function formatCompact(
  n: number,
  kind: ValueKind = "currency",
  cur: CurrencyView = GBP_VIEW,
): string {
  if (!Number.isFinite(n)) return "—";
  if (kind === "percent") return `${Math.round(n * 100)}%`;
  if (kind === "number") return new Intl.NumberFormat("en-US").format(Math.round(n));
  const v = n * cur.rate;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const sym = cur.symbol;
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${Math.round(abs)}`;
}

export function formatLong(
  n: number,
  kind: ValueKind = "currency",
  cur: CurrencyView = GBP_VIEW,
): string {
  if (!Number.isFinite(n)) return "—";
  if (kind === "percent") return `${(n * 100).toFixed(1)}%`;
  if (kind === "number") return new Intl.NumberFormat("en-US").format(Math.round(n));
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: cur.code,
    maximumFractionDigits: 0,
    currencyDisplay: "narrowSymbol",
  }).format(n * cur.rate);
}

export function tickFormatterFor(kind: ValueKind, cur: CurrencyView = GBP_VIEW) {
  if (kind === "percent") return (v: number) => `${Math.round(v * 100)}%`;
  if (kind === "number") return (v: number) => new Intl.NumberFormat("en-US").format(Math.round(v));
  return (v: number) => formatCompact(v, "currency", cur);
}

export function yAxisWidthFor(kind: ValueKind) {
  return kind === "currency" ? 56 : 48;
}

/** N evenly-spaced colors from a palette, darkest first. */
export function spacedPalette(palette: string[], n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [palette[0]];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(palette[Math.round((i * (palette.length - 1)) / (n - 1))]);
  }
  return out;
}

/** Forecast = strictly after lastActualMonthIso. */
export function isForecastMonth(monthIso: string, lastActualMonthIso?: string | null): boolean {
  if (!lastActualMonthIso) return false;
  return monthIso > lastActualMonthIso;
}
