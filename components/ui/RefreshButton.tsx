"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  function refresh() {
    startTransition(async () => {
      await fetch("/api/refresh", { method: "POST" });
      router.refresh();
      setLastRefreshed(new Date().toLocaleTimeString("en-US", { timeStyle: "short" }));
    });
  }

  return (
    <button
      onClick={refresh}
      disabled={isPending}
      title={lastRefreshed ? `Last refreshed ${lastRefreshed}` : "Force a fresh read from Google Sheets"}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-foreground/95 backdrop-blur-sm transition-colors hover:bg-[var(--card-strong)] disabled:opacity-60",
        className,
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      {isPending ? "Refreshing…" : "Refresh"}
      {lastRefreshed && (
        <span className="text-[10px] text-[color:var(--muted)]">{lastRefreshed}</span>
      )}
    </button>
  );
}
