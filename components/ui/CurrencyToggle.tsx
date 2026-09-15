"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CURRENCY } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * £ / $ segmented toggle. GBP is the base (the sheet's exact figures); USD is a
 * converted view at the fixed rate in lib/config. Writes `?ccy=` and preserves
 * every other filter param.
 */
export function CurrencyToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("ccy")?.toLowerCase() === "usd" ? "usd" : "gbp";

  const set = (ccy: "gbp" | "usd") => {
    if (ccy === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (ccy === "gbp") params.delete("ccy");
    else params.set("ccy", "usd");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?", { scroll: false });
  };

  const opt = (key: "gbp" | "usd", label: string) => (
    <button
      type="button"
      onClick={() => set(key)}
      aria-pressed={active === key}
      className={cn(
        "rounded px-2 py-1 text-[11px] font-semibold tabular-nums transition",
        active === key
          ? "bg-[var(--blue)] text-white"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-black/20 p-0.5"
      role="group"
      aria-label="Display currency"
    >
      {opt("gbp", `${CURRENCY.baseSymbol} GBP`)}
      {opt("usd", `${CURRENCY.usdSymbol} USD`)}
    </div>
  );
}
