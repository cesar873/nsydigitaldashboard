import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";

export type InsightTone = "alert" | "warn" | "win" | "info";
export type Insight = { tone: InsightTone; prose: string };

const ORDER: Record<InsightTone, number> = { alert: 0, warn: 1, win: 2, info: 3 };

const ICONS = {
  win: Check,
  alert: AlertCircle,
  warn: AlertTriangle,
  info: Info,
} as const;

const TONE_BG: Record<InsightTone, string> = {
  win: "bg-[color:var(--green)]/10",
  alert: "bg-[color:var(--red)]/10",
  warn: "bg-[color:var(--amber)]/10",
  info: "bg-[color:var(--blue)]/10",
};

const TONE_FG: Record<InsightTone, string> = {
  win: "text-[color:var(--green)]",
  alert: "text-[color:var(--red)]",
  warn: "text-[color:var(--amber)]",
  info: "text-[color:var(--blue)]",
};

export function WhatToDoNext({
  periodLabel,
  insights,
}: {
  periodLabel: string;
  insights: Insight[];
}) {
  const sorted = [...insights]
    .sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border border-[var(--blue)]/30 px-6 py-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(19,144,235,0.10), rgba(19,144,235,0.02))",
      }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="anton inline-block rounded-md border border-[var(--blue)] px-2 py-0.5 text-[11px] tracking-[0.18em] text-[color:var(--blue)]">
          INSIGHTS
        </span>
        <span className="anton text-[18px] tracking-[0.08em]">
          WHAT TO DO NEXT · {periodLabel.toUpperCase()}
        </span>
      </div>
      <ul className="space-y-2.5">
        {sorted.map((insight, i) => {
          const Icon = ICONS[insight.tone];
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TONE_BG[insight.tone]}`}
              >
                <Icon className={`h-3.5 w-3.5 ${TONE_FG[insight.tone]}`} />
              </span>
              {/* Prose is constructed server-side, never from user input. */}
              <span
                className="text-[13px] leading-[1.55] text-foreground/90 [&_b]:font-semibold [&_b]:text-foreground"
                dangerouslySetInnerHTML={{ __html: insight.prose }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
