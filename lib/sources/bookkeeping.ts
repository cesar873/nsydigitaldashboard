import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

/** Where the two editable fields live on the Bookkeeping tab. */
export const BOOKKEEPING_CATEGORY_COL = "O";
export const BOOKKEEPING_COMMENT_COL = "P";

export type BookkeepingRow = {
  /** 1-based row on the sheet, so a write targets the right cell. */
  sheetRow: number;
  monthIso: string | null;
  date: string;
  transactionId: string;
  type: string;
  accountCode: string;
  /** The category the import assigned — "Uncategorized" means it needs a human. */
  importedCategory: string;
  description: string;
  vendor: string;
  amount: number;
  account: string;
  /** The category a person has since assigned. Empty means still open. */
  assignedCategory: string;
  comment: string;
};

/** Chart-of-accounts options offered when categorising a transaction. */
export type AccountOption = { code: string; category: string; group: string; highCategory: string };

export type Bookkeeping = {
  rows: BookkeepingRow[];
  accounts: AccountOption[];
  /** Distinct High Category values — the options offered when categorising. */
  categoryOptions: string[];
  /** Rows still waiting on a category. */
  openCount: number;
};

/**
 * The Bookkeeping tab holds two blocks side by side: a chart of accounts in
 * columns A–D, and the clarification queue in columns F–P.
 */
export async function getBookkeeping(): Promise<Bookkeeping> {
  const grid = await readTab(TABS.bookkeeping);
  if (grid.length === 0) {
    return { rows: [], accounts: [], categoryOptions: [], openCount: 0 };
  }

  // Chart of accounts, columns A–D.
  const accounts: AccountOption[] = [];
  for (let r = 1; r < grid.length; r++) {
    const code = (grid[r]?.[0] ?? "").trim();
    const category = (grid[r]?.[1] ?? "").trim();
    if (!code || !category) continue;
    accounts.push({
      code,
      category,
      group: (grid[r]?.[2] ?? "").trim(),
      highCategory: (grid[r]?.[3] ?? "").trim(),
    });
  }

  // Clarification queue, columns F–P (indices 5–15).
  const rows: BookkeepingRow[] = [];
  let openCount = 0;
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const date = (row[5] ?? "").trim();
    const id = (row[6] ?? "").trim();
    if (!date && !id) continue;

    const assignedCategory = (row[14] ?? "").trim();
    if (!assignedCategory) openCount++;

    rows.push({
      // Sheet rows are 1-based and the grid index is 0-based.
      sheetRow: r + 1,
      monthIso: parseMonthLabel(date),
      date,
      transactionId: id,
      type: (row[7] ?? "").trim(),
      accountCode: String(row[8] ?? "").trim(),
      importedCategory: (row[9] ?? "").trim(),
      description: (row[10] ?? "").trim(),
      vendor: (row[11] ?? "").trim(),
      amount: parseNumber(row[12]) ?? 0,
      account: (row[13] ?? "").trim(),
      assignedCategory,
      comment: (row[15] ?? "").trim(),
    });
  }

  const categoryOptions = [
    ...new Set(accounts.map((a) => a.highCategory).filter(Boolean)),
  ].sort();

  return { rows, accounts, categoryOptions, openCount };
}
