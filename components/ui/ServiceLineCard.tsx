import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ServiceMetric = {
  label: string;
  format: "currency" | "number" | "percent";
  actual: number;
  plan: number;
  /** Lower is better (churn, CAC) — flips the delta colouring. */
  inverse?: boolean;
};

export type ServiceLine = {
  name: string;
  color: string;
  metrics: ServiceMetric[];
  hasData: boolean;
};

function fmt(v: number, f: ServiceMetric["format"]) {
  if (f === "currency") return formatCurrency(v, { compact: true });
  if (f === "percent") return formatPercent(v);
  return formatNumber(v);
}

/**
 * TNT-style service-line card: value on the left, delta-vs-scenario badge on
 * the right. Reads as "how are we doing against the plan for this line".
 */
export function ServiceLineCard({ line }: { line: ServiceLine }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: line.color }}
        />
        <span className="text-sm font-semibold" style={{ color: line.color }}>
          {line.name}
        </span>
      </div>

      {!line.hasData ? (
        <div className="flex flex-1 items-center text-[13px] text-muted-foreground">
          No data for the latest selected month.
        </div>
      ) : (
        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-border/30 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Metric
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Actual
              </span>
              <span className="w-[52px] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                vs plan
              </span>
            </span>
          </div>
          <div className="space-y-2">
          {line.metrics.map((m) => {
            const diff = m.actual - m.plan;
            const pct = m.plan !== 0 ? diff / Math.abs(m.plan) : null;
            const good = m.inverse ? diff <= 0 : diff >= 0;
            return (
              <div key={m.label} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted-foreground">{m.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {fmt(m.actual, m.format)}
                  </span>
                  {diff === 0 ? (
                    <span className="w-[52px] rounded px-1.5 py-0.5 text-center text-[11px] font-medium bg-muted/30 text-muted-foreground tabular-nums">
                      0.0%
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "w-[52px] rounded px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums",
                        good ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
                      )}
                      title={`Plan ${fmt(m.plan, m.format)}`}
                    >
                      {pct === null
                        ? `${diff > 0 ? "+" : ""}${fmt(diff, m.format)}`
                        : `${pct > 0 ? "+" : ""}${formatPercent(pct, 1)}`}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
