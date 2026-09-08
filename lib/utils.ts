import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  if (opts?.compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
