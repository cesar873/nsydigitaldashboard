import { AlertCircle } from "lucide-react";
import { KpiStat } from "@/components/ui/KpiStat";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { OutstandingPanel, PipelinePanel } from "@/components/tables/PaymentsPanels";
import { PageHero } from "@/components/layout/PageHero";
import { SheetError } from "@/components/ui/SheetError";
import { WhatToDoNext, type Insight } from "@/components/ui/WhatToDoNext";
import { formatMonthLong } from "@/lib/months";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  OPEN_STATUSES, PIPELINE_STATUSES, getInvoices, overdueDays, owed,
} from "@/lib/sources/invoices";
import { getBookkeeping } from "@/lib/sources/bookkeeping";
import { getLastActualMonth } from "@/lib/sources/stats";
import type { SearchParams } from "@/lib/default-range";
import { currencyFrom } from "@/lib/currency";

export const revalidate = 300;
export const metadata = { title: "Payments · Finance Dashboard" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currency = currencyFrom(sp);

  let invoices, bookkeeping, lastActual;
  try {
    [invoices, bookkeeping, lastActual] = await Promise.all([
      getInvoices(),
      getBookkeeping(),
      getLastActualMonth(),
    ]);
  } catch (err) {
    return <SheetError error={err} tab="Invoices" />;
  }

  if (invoices.rows.length === 0) {
    return (
      <SheetError
        error={new Error("The Invoices tab has no rows yet.")}
        tab="Invoices"
      />
    );
  }

  const today = new Date();
  const periodLabel = lastActual ? formatMonthLong(lastActual) : "All invoices";

  const outstanding = invoices.rows
    .filter((i) => OPEN_STATUSES.test(i.status))
    .map((invoice) => ({
      invoice,
      owed: owed(invoice),
      days: overdueDays(invoice, today),
    }))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  const pipeline = invoices.rows.filter((i) => PIPELINE_STATUSES.test(i.status));

  const outstandingTotal = outstanding.reduce((a, o) => a + o.owed, 0);
  const overdue = outstanding.filter((o) => (o.days ?? 0) > 0);
  const overdueTotal = overdue.reduce((a, o) => a + o.owed, 0);
  const worstOverdue = Math.max(0, ...overdue.map((o) => o.days ?? 0));

  const dueSoon = outstanding.filter((o) => {
    if (!o.invoice.dueDate) return false;
    const due = new Date(o.invoice.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const days = (due.getTime() - today.getTime()) / 86_400_000;
    return days >= 0 && days <= 7;
  });
  const dueSoonTotal = dueSoon.reduce((a, o) => a + o.owed, 0);

  const pipelineTotal = pipeline.reduce((a, i) => a + (i.amount ?? 0), 0);

  const collected = invoices.rows.filter(
    (i) => /fully paid/i.test(i.status) && (!lastActual || i.monthIso === lastActual),
  );
  const collectedTotal = collected.reduce((a, i) => a + (i.amount ?? 0), 0);

  const openBookkeeping = bookkeeping.rows.filter((r) => !r.assignedCategory);

  const insights: Insight[] = [];
  if (overdue.length > 0) {
    insights.push({
      tone: worstOverdue > 90 ? "alert" : "warn",
      prose: `<b>${formatCurrency(overdueTotal, { compact: true, currency })}</b> is overdue across <b>${overdue.length}</b> ${overdue.length === 1 ? "invoice" : "invoices"} — the oldest by <b>${formatNumber(worstOverdue)} days</b>. Chase these before anything else.`,
    });
  }
  if (pipeline.length > 0) {
    insights.push({
      tone: "info",
      prose: `<b>${pipeline.length}</b> ${pipeline.length === 1 ? "invoice is" : "invoices are"} drafted but not sent${pipelineTotal > 0 ? ` (<b>${formatCurrency(pipelineTotal, { compact: true, currency })}</b>)` : ""}. Nothing gets collected until they go out.`,
    });
  }
  if (openBookkeeping.length > 0) {
    insights.push({
      tone: "warn",
      prose: `<b>${openBookkeeping.length}</b> transactions are still uncategorised in Bookkeeping. Until they are coded, the expense split on every other tab is provisional.`,
    });
  }
  if (invoices.brokenAmountCount > 0) {
    insights.push({
      tone: "alert",
      prose: `<b>${invoices.brokenAmountCount} of ${invoices.rows.length}</b> invoices have a formula error (<b>#N/A</b>) in the sheet's Amount column, so every total on this page understates. Fix the Amount formula in the Invoices tab.`,
    });
  }
  if (insights.length === 0) {
    insights.push({ tone: "win", prose: "Nothing outstanding, nothing overdue, nothing waiting to be sent." });
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
      <PageHero
        eyebrow="Accounts receivable"
        title="Payments"
        period={periodLabel}
        source="Invoices + Bookkeeping"
      />

      {invoices.brokenAmountCount > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-[var(--red)]/30 bg-[var(--red)]/[0.05] px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--red)]" />
          <p className="text-[13px] leading-relaxed text-foreground/85">
            <b>{invoices.brokenAmountCount} of {invoices.rows.length}</b> invoices show{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">#N/A</code> in the
            sheet&apos;s <b>Amount</b> column — a broken MATCH formula. Those invoices are counted
            but contribute nothing to the figures below, so every total here is understated.
          </p>
        </div>
      )}

      <WhatToDoNext periodLabel={periodLabel} insights={insights} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat
          label="Outstanding AR"
          value={formatCurrency(outstandingTotal, { compact: true, currency })}
          tone={outstandingTotal > 0 ? "warning" : "success"}
          deltaLabel={`${outstanding.length} open`}
        />
        <KpiStat
          label="Overdue"
          value={formatCurrency(overdueTotal, { compact: true, currency })}
          tone={overdueTotal > 0 ? "danger" : "success"}
          deltaLabel={overdue.length > 0 ? `worst ${worstOverdue}d` : "none late"}
        />
        <KpiStat
          label="Due next 7 days"
          value={formatCurrency(dueSoonTotal, { compact: true, currency })}
          deltaLabel={dueSoon.length > 0 ? `${dueSoon.length} due` : "nothing imminent"}
        />
        <KpiStat
          label="Pipeline (pre-send)"
          value={formatCurrency(pipelineTotal, { compact: true, currency })}
          deltaLabel={`${pipeline.length} drafts`}
        />
        <KpiStat
          label={`Collected · ${periodLabel}`}
          value={formatCurrency(collectedTotal, { compact: true, currency })}
          tone={collectedTotal > 0 ? "success" : "neutral"}
          deltaLabel={`${collected.length} paid`}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PipelinePanel
          pipeline={pipeline}
          bookkeeping={bookkeeping.rows}
          categoryOptions={bookkeeping.categoryOptions}
          currency={currency}
        />
        <OutstandingPanel outstanding={outstanding} currency={currency} />
      </section>

      <LiveFooter sources="Invoices + Bookkeeping" />
    </div>
  );
}
