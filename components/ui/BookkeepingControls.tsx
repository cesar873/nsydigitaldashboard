"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

async function save(sheetRow: number, field: "category" | "comment", value: string) {
  const res = await fetch("/api/bookkeeping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetRow, field, value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Write failed");
}

/** Writes the chosen High Category straight back to column O. */
export function CategoryPicker({
  sheetRow,
  value,
  options,
  onError,
}: {
  sheetRow: number;
  value: string;
  options: string[];
  onError: (message: string | null) => void;
}) {
  const [current, setCurrent] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  const [open, setOpen] = useState(false);

  async function choose(next: string) {
    const previous = current;
    setCurrent(next);
    setOpen(false);
    setState("saving");
    onError(null);
    try {
      await save(sheetRow, "category", next);
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      // Put the old value back so the screen never disagrees with the sheet.
      setCurrent(previous);
      setState("error");
      onError(e instanceof Error ? e.message : "Write failed");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex w-[128px] items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
          current
            ? "bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
            : "bg-[color:var(--blue)] text-white hover:brightness-110",
          state === "error" && "bg-rose-500/70 text-white",
        )}
      >
        {state === "saving" ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : state === "saved" ? (
          <Check className="h-3 w-3 shrink-0 text-emerald-300" />
        ) : null}
        <span className="flex-1 truncate text-left" title={current || undefined}>
          {current || "Category"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          <div className="border-b border-border/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Chart of accounts
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {current && (
              <button
                onClick={() => choose("")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            {options.map((o) => (
              <button
                key={o}
                onClick={() => choose(o)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/40",
                  o === current && "text-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    o === current ? "border-emerald-400 bg-emerald-500/25" : "border-border",
                  )}
                >
                  {o === current && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{o}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Writes a free-text note back to column P. */
export function CommentButton({
  sheetRow,
  value,
  onError,
}: {
  sheetRow: number;
  value: string;
  onError: (message: string | null) => void;
}) {
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  const [open, setOpen] = useState(false);

  async function commit() {
    const previous = current;
    setCurrent(draft);
    setOpen(false);
    setState("saving");
    onError(null);
    try {
      await save(sheetRow, "comment", draft);
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setCurrent(previous);
      setDraft(previous);
      setState("error");
      onError(e instanceof Error ? e.message : "Write failed");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(current); }}>
      <Popover.Trigger
        className={cn(
          "inline-flex w-[104px] items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
          current
            ? "bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
            : "bg-[color:var(--blue)] text-white hover:brightness-110",
          state === "error" && "bg-rose-500/70 text-white",
        )}
        title={current || undefined}
      >
        {state === "saving" ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : state === "saved" ? (
          <Check className="h-3 w-3 shrink-0 text-emerald-300" />
        ) : null}
        <span className="flex-1 truncate text-left">{current || "Comment"}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Comment
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Why is this categorised the way it is?"
            className="w-full rounded-md border border-border/60 bg-background/70 px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={commit}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
            >
              Save to sheet
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
