import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { col, headerMap, isSheetError, parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type InvoiceStatus =
  | "Fully Paid"
  | "Partially Paid"
  | "Unpaid"
  | "Ready"
  | "AgenCFO Review"
  | "Client Review"
  | string;

export type Invoice = {
  monthIso: string | null;
  monthLabel: string;
  client: string;
  service: string;
  currency: string;
  payPlatform: string;
  amount: number | null;
  openAmount: number | null;
  invoiceDate: string;
  dueDate: string;
  sentDate: string;
  paidDate: string;
  status: InvoiceStatus;
  invoiceNumber: string;
  daysOverdue: number | null;
  adSpend: number | null;
  discounts: number | null;
  notes: string;
  /** The sheet's Amount cell is a formula error, so totals understate. */
  amountBroken: boolean;
};

export type Invoices = {
  rows: Invoice[];
  /** Invoices whose Amount cell is a spreadsheet error. */
  brokenAmountCount: number;
};

/** Statuses that mean the invoice has been sent and money is still owed. */
export const OPEN_STATUSES = /^(unpaid|partially paid|overdue)/i;
/** Statuses that mean the invoice has not gone out yet. */
export const PIPELINE_STATUSES = /^(ready|agencfo review|client review|draft)/i;

export async function getInvoices(): Promise<Invoices> {
  const grid = await readTab(TABS.invoices);
  const headerIdx = grid.findIndex((r) => r.some((c) => /^client$/i.test((c ?? "").trim())));
  if (headerIdx === -1) return { rows: [], brokenAmountCount: 0 };

  const map = headerMap(grid[headerIdx]);
  const ci = {
    month: col(map, "month"),
    client: col(map, "client"),
    service: col(map, "service"),
    currency: col(map, "currency"),
    platform: col(map, "pay platform"),
    adSpend: col(map, "ad spend"),
    discounts: col(map, "discounts"),
    amount: col(map, "amount"),
    amountUsd: col(map, "amount usd"),
    invoiceDate: col(map, "invoice date"),
    dueDate: col(map, "due date"),
    status: col(map, "status"),
    sentDate: col(map, "sent date"),
    paidDate: col(map, "paid date"),
    number: col(map, "invoice number"),
    overdue: col(map, "days overdue"),
    open: col(map, "open amount"),
    notes: col(map, "notes"),
  };

  const rows: Invoice[] = [];
  let brokenAmountCount = 0;

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const client = (row[ci.client] ?? "").trim();
    if (!client) continue;

    const rawAmount = row[ci.amount] ?? "";
    const rawUsd = ci.amountUsd >= 0 ? (row[ci.amountUsd] ?? "") : "";
    const amountBroken = isSheetError(rawAmount) && isSheetError(rawUsd);
    if (amountBroken) brokenAmountCount++;

    const monthLabel = (row[ci.month] ?? "").trim();
    rows.push({
      monthIso: parseMonthLabel(monthLabel),
      monthLabel,
      client,
      service: (row[ci.service] ?? "").trim(),
      currency: (row[ci.currency] ?? "").trim(),
      payPlatform: (row[ci.platform] ?? "").trim(),
      amount: parseNumber(rawAmount) ?? parseNumber(rawUsd),
      openAmount: parseNumber(row[ci.open]),
      invoiceDate: (row[ci.invoiceDate] ?? "").trim(),
      dueDate: (row[ci.dueDate] ?? "").trim(),
      sentDate: (row[ci.sentDate] ?? "").trim(),
      paidDate: (row[ci.paidDate] ?? "").trim(),
      status: (row[ci.status] ?? "").trim(),
      invoiceNumber: (row[ci.number] ?? "").trim(),
      daysOverdue: parseNumber(row[ci.overdue]),
      adSpend: parseNumber(row[ci.adSpend]),
      discounts: parseNumber(row[ci.discounts]),
      notes: (row[ci.notes] ?? "").trim(),
      amountBroken,
    });
  }

  return { rows, brokenAmountCount };
}

/** Open amount owed, falling back to the invoice amount when not split out. */
export function owed(inv: Invoice): number {
  if (inv.openAmount !== null) return inv.openAmount;
  if (/fully paid/i.test(inv.status)) return 0;
  return inv.amount ?? 0;
}

/** Days past the due date, derived when the sheet's own column is empty. */
export function overdueDays(inv: Invoice, today: Date): number | null {
  if (inv.daysOverdue !== null) return inv.daysOverdue;
  if (!inv.dueDate) return null;
  const due = new Date(inv.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : null;
}
