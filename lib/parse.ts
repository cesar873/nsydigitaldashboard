/**
 * Sheet cells arrive as strings. These helpers are deliberately forgiving:
 * the sheet contains "$2,000", "(1,234)", "66.7%", "#N/A" and blanks.
 */

/** "#N/A", "#REF!", "#DIV/0!" etc. — treated as missing, never as 0-with-meaning. */
export function isSheetError(raw: string): boolean {
  return /^#(N\/A|REF!|DIV\/0!|VALUE!|NAME\?|NUM!|NULL!)/i.test(raw.trim());
}

/** Returns null (not 0) when a cell is blank or an error, so KPIs can show "—". */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || isSheetError(s)) return null;

  const isPercent = s.endsWith("%");
  // QBO/Xero exports wrap negatives in parens.
  const parenNegative = /^\(.*\)$/.test(s);
  if (parenNegative) s = s.slice(1, -1);

  s = s.replace(/[$,\s%]/g, "").replace(/[–−]/g, "-");
  if (!s || s === "-") return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  const signed = parenNegative ? -Math.abs(n) : n;
  return isPercent ? signed / 100 : signed;
}

/** parseNumber with a 0 fallback — for summing columns where blank means zero. */
export function parseAmount(raw: string | undefined): number {
  return parseNumber(raw) ?? 0;
}

export function cell(grid: string[][], row: number, col: number): string {
  return grid[row]?.[col] ?? "";
}

/** Finds the first row whose first column matches, case-insensitively. */
export function findRowIndex(grid: string[][], label: RegExp, col = 0): number {
  return grid.findIndex((row) => label.test((row[col] ?? "").trim()));
}

/** Builds a header-name → column-index map from a header row. */
export function headerMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    // First occurrence wins, so a duplicated header (e.g. two "Media Buyers"
    // columns in the capacity matrix) doesn't silently overwrite the first.
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

export function col(map: Map<string, number>, ...names: string[]): number {
  for (const n of names) {
    const i = map.get(n.trim().toLowerCase());
    if (i !== undefined) return i;
  }
  return -1;
}
