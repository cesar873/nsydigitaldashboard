/** Month keys are ISO first-of-month strings: "2026-04-01". */

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function monthIso(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-01`;
}

/** Parses "Jan 2024", "January 2024", "2024-01-01", "31 Aug 2026" → ISO month. */
export function parseMonthLabel(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) return monthIso(Number(isoMatch[1]), Number(isoMatch[2]) - 1);

  const named = s.match(/([A-Za-z]{3,9})\s+(\d{4})$/);
  if (named) {
    const idx = MONTH_LABELS.findIndex((m) => named[1].toLowerCase().startsWith(m.toLowerCase()));
    if (idx >= 0) return monthIso(Number(named[2]), idx);
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return monthIso(parsed.getFullYear(), parsed.getMonth());
  return null;
}

export function formatMonthShort(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`;
}

export function formatMonthLong(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const full = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${full[m - 1]} ${y}`;
}

export function addMonthsIso(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return monthIso(Math.floor(total / 12), total % 12);
}

export function monthRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso;
  // Guard against inverted ranges and runaway loops.
  for (let i = 0; i < 600 && cur <= toIso; i++) {
    out.push(cur);
    cur = addMonthsIso(cur, 1);
  }
  return out;
}

/** "April 2026" for one month, "Apr → Jun 2026 (3 months)" for a span. */
export function periodLabel(months: string[]): string {
  if (months.length === 0) return "No period";
  if (months.length === 1) return formatMonthLong(months[0]);
  const sorted = [...months].sort();
  return `${formatMonthShort(sorted[0])} → ${formatMonthShort(sorted[sorted.length - 1])} (${months.length} months)`;
}

/** Same length as `months`, immediately preceding it. */
export function priorPeriod(months: string[]): string[] {
  if (months.length === 0) return [];
  const sorted = [...months].sort();
  return sorted.map((_, i) => addMonthsIso(sorted[0], -(months.length - i)));
}
