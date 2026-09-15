import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type RowKind = "section" | "detail" | "total";

export type PnlRow = {
  label: string;
  kind: RowKind;
  /** Section this row belongs to ("REVENUE", "COST OF SALES", …). */
  section: string;
  byMonth: Map<string, number>;
  /** True when the tab carried this label more than once (values summed). */
  duplicated: boolean;
};

export type IncomeSummary = {
  tabName: string;
  months: string[];
  /** Lower-cased label → row. */
  rows: Map<string, PnlRow>;
  /** Sheet order, for statement-style rendering. */
  order: string[];
  actualMonths: Set<string>;
  duplicateLabels: string[];
};

const TOTAL_LABEL =
  /^(total\b|gross profit$|operating profit$|net profit$|grand total)/i;

/**
 * A section header is a label row carrying no numbers. Case is not a reliable
 * signal — this sheet mixes "OPERATING EXPENSES" with "Other Expense" and
 * "Balance Sheet Summary", all of which are headers.
 */
function isSectionHeader(label: string, hasValues: boolean): boolean {
  if (hasValues) return false;
  return label.replace(/[^A-Za-z]/g, "").length > 1;
}

/**
 * Finance Model / Finance Plan share one wide layout: col A = row label,
 * one column per month. Rows are matched by LABEL, never by index — the two
 * tabs are not row-aligned (Finance Plan carries an extra line).
 */
export async function readSummary(tabName: string): Promise<IncomeSummary> {
  const grid = await readTab(tabName);

  let headerIdx = -1;
  let monthCols: { col: number; iso: string }[] = [];
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const found: { col: number; iso: string }[] = [];
    (grid[r] ?? []).forEach((raw, c) => {
      const iso = parseMonthLabel(raw);
      if (iso) found.push({ col: c, iso });
    });
    if (found.length >= 3) {
      headerIdx = r;
      monthCols = found;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      tabName,
      months: [],
      rows: new Map(),
      order: [],
      actualMonths: new Set(),
      duplicateLabels: [],
    };
  }

  const months = monthCols.map((m) => m.iso);
  const rows = new Map<string, PnlRow>();
  const order: string[] = [];
  const actualMonths = new Set<string>();
  const duplicateLabels: string[] = [];
  let currentSection = "";

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const label = (grid[r]?.[0] ?? "").trim();
    if (!label) continue;

    if (/^status$/i.test(label)) {
      for (const { col, iso } of monthCols) {
        if (/actual/i.test(grid[r]?.[col] ?? "")) actualMonths.add(iso);
      }
      continue;
    }

    const values = new Map<string, number>();
    let hasValues = false;
    for (const { col, iso } of monthCols) {
      const n = parseNumber(grid[r]?.[col]);
      if (n !== null) hasValues = true;
      values.set(iso, n ?? 0);
    }

    if (isSectionHeader(label, hasValues)) {
      currentSection = label;
      const key = label.toLowerCase();
      if (!rows.has(key)) {
        order.push(key);
        rows.set(key, {
          label,
          kind: "section",
          section: label,
          byMonth: values,
          duplicated: false,
        });
      }
      continue;
    }

    const key = label.toLowerCase();
    const existing = rows.get(key);
    if (existing) {
      // A row repeated with *identical* values is an echo — the same figure
      // shown in two blocks (e.g. "Total Cash" in the Balance Sheet Summary and
      // again as "TOTAL CASH" in the ASSETS list). A balance is not additive, so
      // summing those double-counts it. Only genuinely different duplicate lines
      // — which the sheet's own totals expect to be added — are summed.
      const isEcho = months.every(
        (m) => (existing.byMonth.get(m) ?? 0) === (values.get(m) ?? 0),
      );
      if (!isEcho) {
        // The sheet repeats this label with different values; summing is what
        // reconciles. Reported, not silently merged.
        for (const m of months) {
          existing.byMonth.set(m, (existing.byMonth.get(m) ?? 0) + (values.get(m) ?? 0));
        }
        if (!existing.duplicated) {
          existing.duplicated = true;
          duplicateLabels.push(label);
        }
      }
      continue;
    }

    order.push(key);
    rows.set(key, {
      label,
      kind: TOTAL_LABEL.test(label) ? "total" : "detail",
      section: currentSection,
      byMonth: values,
      duplicated: false,
    });
  }

  return { tabName, months, rows, order, actualMonths, duplicateLabels };
}

/** Backwards-compatible reader for the actuals P&L. */
export function getIncomeSummary() {
  return readSummary(TABS.financeModel);
}

export function seriesFor(
  summary: IncomeSummary,
  pattern: RegExp,
): Map<string, number> | null {
  for (const row of summary.rows.values()) {
    if (pattern.test(row.label)) {
      const out = new Map<string, number>();
      for (const m of summary.months) out.set(m, row.byMonth.get(m) ?? 0);
      return out;
    }
  }
  return null;
}

export function sumMonths(series: Map<string, number> | null, months: string[]): number {
  if (!series) return 0;
  return months.reduce((acc, m) => acc + (series.get(m) ?? 0), 0);
}

/** Exact-label lookup, used where a regex would be ambiguous. */
export function rowFor(summary: IncomeSummary, label: string): PnlRow | null {
  return summary.rows.get(label.trim().toLowerCase()) ?? null;
}
