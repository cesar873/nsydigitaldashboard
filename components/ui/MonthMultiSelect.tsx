"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMonthShort } from "@/lib/months";
import { cn } from "@/lib/utils";

export function MonthMultiSelect({
  options,
  selected,
}: {
  options: string[];
  selected: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    // Default state never appears in the URL (formatting.md §3.2).
    if (next.length === 0 || next.length === options.length) params.delete("months");
    else params.set("months", [...next].sort().join(","));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function toggle(month: string) {
    commit(
      selected.includes(month)
        ? selected.filter((m) => m !== month)
        : [...selected, month],
    );
  }

  const summary =
    selected.length === 0
      ? "All months"
      : selected.length === options.length
        ? "All months"
        : selected.length === 1
          ? formatMonthShort(selected[0])
          : `${formatMonthShort([...selected].sort().at(-1)!)} +${selected.length - 1}`;

  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm font-medium text-foreground/95 backdrop-blur-sm hover:bg-card/60">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Period
        </span>
        <span>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {selected.length} of {options.length} selected
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => commit(options)}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                All
              </button>
              <button
                onClick={() => commit([options.at(-1)!])}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Latest
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {[...options].reverse().map((month) => {
              const checked = selected.includes(month);
              return (
                <div
                  key={month}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-sky-400 bg-sky-500/30 text-sky-300"
                        : "border-border",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <button
                    onClick={() => toggle(month)}
                    className="flex-1 text-left text-sm"
                  >
                    {formatMonthShort(month)}
                  </button>
                  <button
                    onClick={() => commit([month])}
                    title={`Only ${formatMonthShort(month)}`}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    only
                  </button>
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
