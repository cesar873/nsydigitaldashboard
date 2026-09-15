import { CURRENCY } from "@/lib/config";

/** Currency codes the dashboard can display. Base (GBP) is exact. */
export type Ccy = "GBP" | "USD";

/**
 * The active display currency, resolved once per request from `?ccy=` and
 * threaded into every money formatter. `rate` is the multiplier from the base
 * (GBP) to this currency, so converting is always `gbpValue * view.rate`.
 */
export type CurrencyView = {
  code: Ccy;
  symbol: string;
  /** Multiplier from base (GBP) → this currency. 1 for the base itself. */
  rate: number;
};

export const GBP_VIEW: CurrencyView = {
  code: "GBP",
  symbol: CURRENCY.baseSymbol,
  rate: 1,
};

export const USD_VIEW: CurrencyView = {
  code: "USD",
  symbol: CURRENCY.usdSymbol,
  rate: CURRENCY.usdPerGbp,
};

/** Reads the display currency from a page's searchParams. Defaults to base. */
export function parseCcy(
  sp: Record<string, string | string[] | undefined> | undefined,
): Ccy {
  const raw = sp?.ccy;
  const v = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  return v === "usd" ? "USD" : "GBP";
}

export function currencyView(code: Ccy): CurrencyView {
  return code === "USD" ? USD_VIEW : GBP_VIEW;
}

/** Resolve straight from searchParams — the common case in a page. */
export function currencyFrom(
  sp: Record<string, string | string[] | undefined> | undefined,
): CurrencyView {
  return currencyView(parseCcy(sp));
}
