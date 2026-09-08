import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { col, headerMap, parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type Transaction = {
  monthIso: string | null;
  /** The date exactly as the sheet shows it, for display. */
  rawDate: string;
  accountType: string;
  accountCode: string;
  account: string;
  contact: string;
  description: string;
  net: number;
  summaryCategory: string;
  /** The sheet's own mapping check — "MISSING" means unmapped upstream. */
  check: string;
};

export type Transactions = {
  rows: Transaction[];
  /** Rows the sheet flags as unmapped. Surfaced rather than silently dropped. */
  unmappedCount: number;
};

/** Transactions tab: one row per ledger line (Xero-style export). */
export async function getTransactions(): Promise<Transactions> {
  const grid = await readTab(TABS.transactions);

  const headerIdx = grid.findIndex((row) =>
    row.some((c) => /^date$/i.test((c ?? "").trim())),
  );
  if (headerIdx === -1) return { rows: [], unmappedCount: 0 };

  const map = headerMap(grid[headerIdx]);
  const ci = {
    date: col(map, "date"),
    accountType: col(map, "account type"),
    accountCode: col(map, "account code"),
    account: col(map, "account"),
    contact: col(map, "contact"),
    description: col(map, "description"),
    net: col(map, "net (usd)", "net", "amount"),
    summary: col(map, "summary category"),
    check: col(map, "check"),
  };

  const rows: Transaction[] = [];
  let unmappedCount = 0;

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const dateRaw = (row[ci.date] ?? "").trim();
    const net = parseNumber(row[ci.net]);
    if (!dateRaw && net === null) continue;

    const check = ci.check >= 0 ? (row[ci.check] ?? "").trim() : "";
    if (/missing/i.test(check)) unmappedCount++;

    rows.push({
      monthIso: parseMonthLabel(dateRaw),
      rawDate: dateRaw,
      accountType: ci.accountType >= 0 ? (row[ci.accountType] ?? "").trim() : "",
      accountCode: ci.accountCode >= 0 ? (row[ci.accountCode] ?? "").trim() : "",
      account: ci.account >= 0 ? (row[ci.account] ?? "").trim() : "",
      contact: ci.contact >= 0 ? (row[ci.contact] ?? "").trim() : "",
      description: ci.description >= 0 ? (row[ci.description] ?? "").trim() : "",
      net: net ?? 0,
      summaryCategory: ci.summary >= 0 ? (row[ci.summary] ?? "").trim() : "",
      check,
    });
  }

  return { rows, unmappedCount };
}

/**
 * Expense-side ledger rows, signed. A negative Net on an expense row is money
 * coming back (a refund via "Receive Money"), so the sign is preserved rather
 * than absolute-valued — otherwise a refund reads as a second expense.
 */
export function expenseRows(tx: Transactions): Transaction[] {
  return tx.rows.filter((t) => /expense/i.test(t.accountType));
}

export function costByCategory(
  rows: Transaction[],
  months: string[],
): { name: string; value: number }[] {
  const set = new Set(months);
  const totals = new Map<string, number>();
  for (const t of rows) {
    if (!t.monthIso || !set.has(t.monthIso)) continue;
    const key = t.summaryCategory || t.account || "Uncategorized";
    totals.set(key, (totals.get(key) ?? 0) + t.net);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function costByVendor(
  rows: Transaction[],
  months: string[],
): { name: string; value: number }[] {
  const set = new Set(months);
  const totals = new Map<string, number>();
  for (const t of rows) {
    if (!t.monthIso || !set.has(t.monthIso)) continue;
    const key = t.contact || "Unknown vendor";
    totals.set(key, (totals.get(key) ?? 0) + t.net);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Monthly stacked rows by category, capped to the top N categories. */
export function monthlyByCategory(
  rows: Transaction[],
  months: string[],
  topN = 8,
): { keys: string[]; rows: Record<string, string | number>[] } {
  const ranked = costByCategory(rows, months).slice(0, topN).map((c) => c.name);
  const keys = [...ranked, "Other"];
  const monthSet = new Set(months);

  const out = months.map((m) => {
    const row: Record<string, string | number> = { label: m };
    for (const k of keys) row[k] = 0;
    return row;
  });
  const byMonth = new Map(out.map((r) => [String(r.label), r]));

  for (const t of rows) {
    if (!t.monthIso || !monthSet.has(t.monthIso)) continue;
    const target = byMonth.get(t.monthIso);
    if (!target) continue;
    const raw = t.summaryCategory || t.account || "Uncategorized";
    const key = ranked.includes(raw) ? raw : "Other";
    target[key] = Number(target[key]) + t.net;
  }

  return { keys, rows: out };
}

export function totalCost(rows: Transaction[], months: string[]): number {
  const set = new Set(months);
  return rows.reduce(
    (acc, t) => (t.monthIso && set.has(t.monthIso) ? acc + t.net : acc),
    0,
  );
}
