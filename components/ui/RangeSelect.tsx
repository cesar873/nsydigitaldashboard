"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatMonthShort, monthIso } from "@/lib/months";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthPicker({
  valueIso,
  minIso,
  maxIso,
  onPick,
}: {
  valueIso: string;
  minIso: string;
  maxIso: string;
  onPick: (iso: string) => void;
}) {
  const [year, setYear] = useState(Number(valueIso.slice(0, 4)));
  const minYear = Number(minIso.slice(0, 4));
  const maxYear = Number(maxIso.slice(0, 4));

  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-black/20 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/30 focus:outline-none focus:ring-1 focus:ring-[var(--blue)]">
        {formatMonthShort(valueIso)}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setYear((y) => Math.max(minYear, y - 1))}
              disabled={year <= minYear}
              className="disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <button
              onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
              disabled={year >= maxYear}
              className="disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((label, i) => {
              const iso = monthIso(year, i);
              const disabled = iso < minIso || iso > maxIso;
              const selected = iso === valueIso;
              return (
                <button
                  key={label}
                  disabled={disabled}
                  onClick={() => onPick(iso)}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition",
                    disabled && "text-muted-foreground/30",
                    !disabled && !selected && "text-foreground hover:bg-muted/40",
                    selected && "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/60",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function RangeSelect({
  fromIso,
  toIso,
  minIso,
  maxIso,
}: {
  fromIso: string;
  toIso: string;
  minIso: string;
  maxIso: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function commit(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm font-medium text-foreground/95 backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Range
      </span>
      <MonthPicker
        valueIso={fromIso}
        minIso={minIso}
        maxIso={maxIso}
        // Picking a `from` past `to` snaps `to` forward to stay valid.
        onPick={(iso) => commit(iso, iso > toIso ? iso : toIso)}
      />
      <span className="text-xs text-muted-foreground">→</span>
      <MonthPicker
        valueIso={toIso}
        minIso={minIso}
        maxIso={maxIso}
        onPick={(iso) => commit(iso < fromIso ? iso : fromIso, iso)}
      />
    </div>
  );
}
