"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CategoryPicker, CommentButton } from "@/components/ui/BookkeepingControls";
import { TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from "@/components/charts/chart-shared";
import type { Invoice } from "@/lib/sources/invoices";
import type { BookkeepingRow } from "@/lib/sources/bookkeeping";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const tone = /fully paid/.test(lower)
    ? "bg-emerald-500/15 text-emerald-300"
    : /partially/.test(lower)
      ? "bg-amber-500/15 text-amber-300"
      : /unpaid|overdue/.test(lower)
        ? "bg-rose-500/15 text-rose-300"
        : /review/.test(lower)
          ? "bg-purple-500/15 text-purple-300"
          : "bg-sky-500/15 text-sky-300";
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone,
      )}
    >
      {status || "—"}
    </span>
  );
}

function Amount({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        className="text-[12px] text-amber-300/80"
        title="The sheet's Amount cell is a formula error (#N/A)"
      >
        n/a
      </span>
    );
  }
  return <span className="text-[13px] tabular-nums">{formatCurrency(value, { compact: true })}</span>;
}

/**
 * Left-hand panel: the pipeline of invoices waiting to go out, and the
 * bookkeeping queue of transactions waiting on a category. Category and comment
 * write straight back to columns O and P of the Bookkeeping tab.
 */
export function PipelinePanel({
  pipeline,
  bookkeeping,
  categoryOptions,
}: {
  pipeline: Invoice[];
  bookkeeping: BookkeepingRow[];
  categoryOptions: string[];
}) {
  const [tab, setTab] = useState<"invoices" | "transactions">("invoices");
  const [writeError, setWriteError] = useState<string | null>(null);
  const open = bookkeeping.filter((r) => !r.assignedCategory);
  const pipelineTotal = pipeline.reduce((a, i) => a + (i.amount ?? 0), 0);
  const openTotal = open.reduce((a, r) => a + Math.abs(r.amount), 0);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {tab === "invoices" ? "Pipeline" : "Bookkeeping"}
          </div>
          <h2 className="anton mt-0.5 text-[18px] tracking-[0.06em]">
            {tab === "invoices" ? "Upcoming invoices" : "Transactions"}
          </h2>
        </div>

        <div className="ml-auto inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-sm shadow-sm">
          <button
            onClick={() => setTab("invoices")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              tab === "invoices"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Invoices
          </button>
          <button
            onClick={() => setTab("transactions")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              tab === "transactions"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Transactions
            {open.length > 0 && (
              <span className="rounded-full bg-rose-500/80 px-1.5 text-[10px] font-bold text-white">
                {open.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === "invoices" ? (
        <div className="max-h-[520px] overflow-auto">
          <div className="flex items-baseline justify-between gap-3 px-5 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-300">
                Awaiting review · {pipeline.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Drafted and ready, not yet sent to the client
              </div>
            </div>
            <span className="text-[13px] font-semibold tabular-nums">
              {formatCurrency(pipelineTotal, { compact: true })}
            </span>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-20 sticky-bg">
                {["Date", "Client", "Service", "Amount", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "border-y border-border/40 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                      i === 3 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipeline.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing waiting to be sent.
                  </td>
                </tr>
              ) : (
                pipeline.map((inv, i) => (
                  <tr key={i} className="border-b border-border/25 hover:bg-white/[0.05]">
                    <td className="whitespace-nowrap px-4 py-2 text-[12px] tabular-nums text-muted-foreground">
                      {inv.invoiceDate || inv.monthLabel || "—"}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-medium">
                      <span className="block max-w-[180px] truncate" title={inv.client}>
                        {inv.client}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-muted-foreground">{inv.service || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Amount value={inv.amount} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <div className="flex items-baseline justify-between gap-3 px-5 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-300">
                Awaiting clarification · {open.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Imported without a category — assign one in the Bookkeeping tab
              </div>
            </div>
            <span className="text-[13px] font-semibold tabular-nums">
              {formatCurrency(openTotal, { compact: true })}
            </span>
          </div>

          {writeError && (
            <div className="mx-5 mb-3 flex items-start gap-2 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/[0.06] px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--red)]" />
              <span className="text-[12px] leading-relaxed text-foreground/85">{writeError}</span>
            </div>
          )}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-20 sticky-bg">
                {["Date", "Transaction", "Amount", "Category", "Comment"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "border-y border-border/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                      i === 2 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {open.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Every transaction has a category.
                  </td>
                </tr>
              ) : (
                open.map((row, i) => (
                  <tr key={i} className="border-b border-border/25 hover:bg-white/[0.05]">
                    <td className="whitespace-nowrap px-3 py-2 align-top text-[12px] tabular-nums text-muted-foreground">
                      {row.date}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block max-w-[240px] truncate text-[13px]" title={row.description}>
                        {row.description || "—"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {[row.vendor, row.account].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-2 align-top text-right text-[13px] tabular-nums",
                        row.amount < 0 && "text-rose-300",
                      )}
                    >
                      {formatCurrency(row.amount, { compact: true })}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <CategoryPicker
                        sheetRow={row.sheetRow}
                        value={row.assignedCategory}
                        options={categoryOptions}
                        onError={setWriteError}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <CommentButton
                        sheetRow={row.sheetRow}
                        value={row.comment}
                        onError={setWriteError}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Right-hand panel: what has been sent and is still owed. */
export function OutstandingPanel({
  outstanding,
}: {
  outstanding: { invoice: Invoice; owed: number; days: number | null }[];
}) {
  const total = outstanding.reduce((a, o) => a + o.owed, 0);
  const unpaid = outstanding.filter((o) => /unpaid/i.test(o.invoice.status));
  const partial = outstanding.filter((o) => /partially/i.test(o.invoice.status));
  const unpaidTotal = unpaid.reduce((a, o) => a + o.owed, 0);
  const partialTotal = partial.reduce((a, o) => a + o.owed, 0);
  const overdueTotal = outstanding
    .filter((o) => (o.days ?? 0) > 0)
    .reduce((a, o) => a + o.owed, 0);

  const donut = [
    { name: "Unpaid", value: unpaidTotal, count: unpaid.length, color: "#f59e0b" },
    { name: "Partially paid", value: partialTotal, count: partial.length, color: "#fcd34d" },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Outstanding invoices
      </div>
      <div className="anton mt-1 text-[26px] leading-none tracking-[0.5px] tabular-nums">
        {formatCurrency(total, { compact: true })}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {outstanding.length} sent, not yet collected
        {overdueTotal > 0 && (
          <span className="text-rose-300"> · {formatCurrency(overdueTotal, { compact: true })} overdue</span>
        )}
      </div>

      {/* Split of what is owed. */}
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {donut.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(v, n) => [formatCurrency(Number(v), { compact: true }), n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Open</span>
            <span className="anton text-[17px] leading-none tabular-nums">
              {formatCurrency(total, { compact: true })}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-[11px]">
          {donut.map((d) => (
            <div key={d.name} className="flex items-baseline gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              <span className="text-muted-foreground">
                {d.name} <span className="text-muted-foreground/70">({d.count})</span>
              </span>
              <span className="ml-auto font-semibold tabular-nums">
                {formatCurrency(d.value, { compact: true })}
              </span>
              <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">
                {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-border/40 pt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sent &amp; unpaid
        </div>
        <div className="max-h-[280px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-20 sticky-bg">
                {["Client", "Service", "Amount", "Due", "Days"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "border-b border-border/40 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                      i >= 2 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outstanding.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Nothing outstanding.
                  </td>
                </tr>
              ) : (
                outstanding.map(({ invoice, owed, days }, i) => {
                  return (
                    <tr key={i} className="border-b border-border/25 hover:bg-white/[0.05]">
                      <td className="px-2 py-1.5 text-[13px] font-medium">
                        <span className="block max-w-[130px] truncate" title={invoice.client}>
                          {invoice.client}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-[12px] text-muted-foreground">
                        <span className="block max-w-[110px] truncate">{invoice.service || "—"}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[13px] tabular-nums">
                        {formatCurrency(owed, { compact: true })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[12px] text-muted-foreground">
                        {invoice.dueDate || "—"}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5 text-right text-[12px] font-semibold tabular-nums",
                          days === null
                            ? "text-muted-foreground"
                            : days > 90
                              ? "text-rose-300"
                              : "text-amber-300",
                        )}
                      >
                        {days === null ? "—" : `${days}d`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
