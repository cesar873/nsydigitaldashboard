"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PopoverOption = { value: string; label: string };

/**
 * Single-select styled to match the Period/Range popovers (formatting.md
 * §3.1.a) rather than a native <select>, which renders as a grey OS control.
 */
export function PopoverSelect({
  eyebrow,
  options,
  value,
  onChange,
  width = "w-56",
  columns = 1,
}: {
  eyebrow: string;
  options: PopoverOption[];
  value: string;
  onChange: (value: string) => void;
  width?: string;
  columns?: 1 | 3;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm font-medium text-foreground/95 backdrop-blur-sm hover:bg-card/60">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </span>
        <span>{current?.label ?? "Select"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl",
            width,
          )}
        >
          <div
            className={cn(
              "max-h-72 overflow-y-auto py-1",
              columns === 3 && "grid grid-cols-3 gap-1 p-2",
            )}
          >
            {options.map((option) => {
              const selected = option.value === value;
              if (columns === 3) {
                return (
                  <Popover.Close asChild key={option.value}>
                    <button
                      onClick={() => onChange(option.value)}
                      className={cn(
                        "rounded-md py-1.5 text-xs font-medium transition",
                        selected
                          ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/60"
                          : "text-foreground hover:bg-muted/40",
                      )}
                    >
                      {option.label}
                    </button>
                  </Popover.Close>
                );
              }
              return (
                <Popover.Close asChild key={option.value}>
                  <button
                    onClick={() => onChange(option.value)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-sky-400 bg-sky-500/30 text-sky-300"
                          : "border-border",
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1">{option.label}</span>
                  </button>
                </Popover.Close>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
