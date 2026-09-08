"use client";

import { X } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { DrillRequest, DrillResult } from "@/lib/drilldown-types";
import { formatNumber } from "@/lib/utils";

type DrillContextValue = { open: (req: DrillRequest) => void };

const DrillContext = createContext<DrillContextValue | null>(null);

/** Charts call this to open the list behind a signed / lost count. */
export function useDrillDown() {
  return useContext(DrillContext);
}

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DrillRequest | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback((req: DrillRequest) => {
    setRequest(req);
    setResult(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setRequest(null);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/drilldown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setResult(data as DrillResult);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Drill-down failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, close]);

  return (
    <DrillContext.Provider value={{ open }}>
      {children}
      {request && (
        <DrillModal result={result} loading={loading} error={error} onClose={close} />
      )}
    </DrillContext.Provider>
  );
}

function DrillModal({
  result,
  loading,
  error,
  onClose,
}: {
  result: DrillResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-[8vh] w-full max-w-[760px] rounded-2xl border border-border/60 bg-[color:var(--popover)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="anton text-[22px] leading-none tracking-[0.5px]">
              {result?.title ?? "Clients"}
            </h2>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {result ? `${result.subtitle} · ${result.source} · ${result.note}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <span className="anton text-[20px] tabular-nums">
                {formatNumber(result.total)}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {error && (
          <div className="rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/[0.05] p-4 text-sm">
            {error}
          </div>
        )}

        {result && !loading && (
          result.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              No client movement in this period.
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-border/40">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-20 sticky-bg">
                    {["Date", "Client", "Service", "Detail"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-border/40 px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/30 hover:bg-white/[0.05]">
                      <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular-nums text-muted-foreground">
                        {row.date}
                      </td>
                      <td className="px-3 py-2 text-[13px] font-medium">{row.client}</td>
                      <td className="px-3 py-2 text-[12px] text-muted-foreground">
                        {row.service}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-muted-foreground">
                        {row.detail || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
