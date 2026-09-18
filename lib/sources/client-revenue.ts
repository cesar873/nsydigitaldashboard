import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { col, headerMap, parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type ClientRevenueRow = {
  client: string;
  id: string;
  status: string;
  service: string;
  intensity: string;
  source: string;
  startDate: string;
  endDate: string;
  teamMembers: string[];
  /** monthIso → revenue */
  byMonth: Map<string, number>;
};

export type ClientRevenue = {
  rows: ClientRevenueRow[];
  months: string[];
};

/**
 * Client Revenue tab: metadata columns then one column per month
 * (Jan 2024 → Dec 2027 in the 4.2 sheet).
 */
export async function getClientRevenue(): Promise<ClientRevenue> {
  const grid = await readTab(TABS.services);

  // Header is the first row with a client column — named either "Client" or
  // "Client Name" depending on the sheet's template version.
  const headerIdx = grid.findIndex((row) =>
    row.some((c) => /^client(\s*name)?$/i.test((c ?? "").trim())),
  );
  if (headerIdx === -1) return { rows: [], months: [] };

  const header = grid[headerIdx];
  const map = headerMap(header);
  const monthCols: { col: number; iso: string }[] = [];
  header.forEach((raw, c) => {
    const iso = parseMonthLabel(raw);
    if (iso) monthCols.push({ col: c, iso });
  });

  const ci = {
    client: col(map, "client", "client name"),
    id: col(map, "id"),
    status: col(map, "status"),
    service: col(map, "service"),
    intensity: col(map, "intensity"),
    source: col(map, "source"),
    start: col(map, "start date"),
    end: col(map, "end date"),
    team: col(map, "team members"),
  };

  const rows: ClientRevenueRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const client = (row[ci.client] ?? "").trim();
    if (!client) continue;

    const byMonth = new Map<string, number>();
    for (const { col: c, iso } of monthCols) {
      byMonth.set(iso, parseNumber(row[c]) ?? 0);
    }

    rows.push({
      client,
      id: ci.id >= 0 ? (row[ci.id] ?? "").trim() : "",
      status: ci.status >= 0 ? (row[ci.status] ?? "").trim() : "",
      service: ci.service >= 0 ? (row[ci.service] ?? "").trim() : "",
      intensity: ci.intensity >= 0 ? (row[ci.intensity] ?? "").trim() : "",
      source: ci.source >= 0 ? (row[ci.source] ?? "").trim() : "",
      startDate: ci.start >= 0 ? (row[ci.start] ?? "").trim() : "",
      endDate: ci.end >= 0 ? (row[ci.end] ?? "").trim() : "",
      teamMembers:
        ci.team >= 0
          ? (row[ci.team] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      byMonth,
    });
  }

  return { rows, months: monthCols.map((m) => m.iso) };
}

/** Groups revenue by a metadata dimension for the given months. */
export function revenueByDimension(
  data: ClientRevenue,
  dimension: "service" | "intensity" | "source",
  months: string[],
): { name: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of data.rows) {
    const key = row[dimension] || "Unspecified";
    const amount = months.reduce((acc, m) => acc + (row.byMonth.get(m) ?? 0), 0);
    if (amount === 0) continue;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Monthly stacked-series rows keyed by dimension value. */
export function monthlyByDimension(
  data: ClientRevenue,
  dimension: "service" | "intensity" | "source",
  months: string[],
): { keys: string[]; rows: Record<string, string | number>[] } {
  const keys = [...new Set(data.rows.map((r) => r[dimension] || "Unspecified"))];
  const rows = months.map((m) => {
    const row: Record<string, string | number> = { label: m };
    for (const k of keys) row[k] = 0;
    for (const r of data.rows) {
      const k = r[dimension] || "Unspecified";
      row[k] = Number(row[k]) + (r.byMonth.get(m) ?? 0);
    }
    return row;
  });
  return { keys, rows };
}
