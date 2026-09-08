import type { IncomeSummary } from "./income-summary";

export type ExpenseCategory = {
  label: string;
  group: string;
  byMonth: Map<string, number>;
};

/**
 * Detail cost lines from the Finance Model P&L.
 *
 * Grouping is positional, not by section header: the sheet's "Other Expense"
 * row carries its own (mostly zero) values, so it reads as a data row rather
 * than a header and cannot be detected as one. Anything below
 * TOTAL OPERATING EXPENSES is therefore treated as a non-operating cost.
 */
export function expenseCategories(summary: IncomeSummary): ExpenseCategory[] {
  const totalOpexIdx = summary.order.findIndex((k) =>
    /^total operating expenses$/i.test(summary.rows.get(k)?.label ?? ""),
  );

  const out: ExpenseCategory[] = [];
  summary.order.forEach((key, idx) => {
    const row = summary.rows.get(key);
    if (!row || row.kind !== "detail") return;
    if (/margin/i.test(row.label)) return;

    const isCogs = /^cost of sales$/i.test(row.section);
    const isOpexSection = /^operating expenses$/i.test(row.section);
    if (!isCogs && !isOpexSection) return;

    const belowOpexTotal = totalOpexIdx >= 0 && idx > totalOpexIdx;
    const group = isCogs
      ? "Cost of sales"
      : belowOpexTotal
        ? "Other expenses"
        : "Operating expenses";

    // A zero line below the operating block is a placeholder, not a cost.
    const total = [...row.byMonth.values()].reduce((a, b) => a + b, 0);
    if (belowOpexTotal && total === 0) return;

    out.push({ label: row.label, group, byMonth: row.byMonth });
  });
  return out;
}
