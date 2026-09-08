import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDelta } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger";

/**
 * The value itself is always plain — colour is reserved for the change, so the
 * eye goes to what moved rather than to every number on the page.
 * `deltaInverse` marks metrics where a fall is the good outcome (costs, churn).
 */
export function KpiStat({
  label,
  value,
  delta = null,
  deltaLabel,
  deltaInverse = false,
  size = "sm",
}: {
  label: string;
  value: string;
  /** Retained so callers can express intent; no longer tints the value. */
  tone?: Tone;
  delta?: number | null;
  deltaLabel?: string;
  deltaInverse?: boolean;
  size?: "sm" | "default";
}) {
  const hasDelta = delta !== null && Number.isFinite(delta) && delta !== 0;
  const Icon = !hasDelta ? Minus : delta! > 0 ? ArrowUp : ArrowDown;
  const good = hasDelta ? (deltaInverse ? delta! < 0 : delta! > 0) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--card-border)] bg-[var(--card)] backdrop-blur",
        size === "sm" ? "px-4 py-3" : "px-5 py-4",
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {label}
      </div>
      <div
        className={cn(
          "anton mt-1 tabular-nums text-foreground",
          size === "sm" ? "text-[26px]" : "text-[32px]",
          "leading-[1.1] tracking-[0.5px]",
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs tabular-nums">
        <Icon
          className={cn(
            "h-3 w-3",
            good === null
              ? "text-[color:var(--muted)]"
              : good
                ? "text-[color:var(--green)]"
                : "text-[color:var(--red)]",
          )}
        />
        <span
          className={cn(
            good === null
              ? "text-[color:var(--muted)]"
              : good
                ? "text-[color:var(--green)]"
                : "text-[color:var(--red)]",
          )}
        >
          {formatDelta(delta)}
        </span>
        {deltaLabel && <span className="text-[color:var(--muted)]">{deltaLabel}</span>}
      </div>
    </div>
  );
}
