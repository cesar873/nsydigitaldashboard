import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GBP_VIEW, type CurrencyView } from "@/lib/currency";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money values are stored in the base currency (GBP). Passing a `currency`
 * view converts (× rate) and swaps the symbol; omit it and the value renders
 * in the base currency unchanged.
 */
export function formatCurrency(
  value: number,
  opts?: { compact?: boolean; currency?: CurrencyView },
): string {
  const view = opts?.currency ?? GBP_VIEW;
  const v = value * view.rate;
  if (!Number.isFinite(v)) return "—";
  const sym = view.symbol;
  if (opts?.compact) {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${sym}${Math.round(abs)}`;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: view.code,
    maximumFractionDigits: 0,
    currencyDisplay: "narrowSymbol",
  }).format(v);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** KPI delta: "+12.3%" / "-4.0%" / "—" at exactly zero. */
export function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta) || delta === 0) return "—";
  return `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;
}
