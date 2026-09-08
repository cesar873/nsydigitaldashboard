import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { col, headerMap, parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type ClientProfitRow = {
  monthIso: string | null;
  monthLabel: string;
  client: string;
  service: string;
  intensity: string;
  teamMembers: string[];
  revenue: number;
  peopleCost: number;
  referralFees: number;
  acquisitionCost: number;
  otherCosts: number;
  profit: number;
  margin: number | null;
};

/**
 * The Client Profit tab is an append-only monthly rollup: one row per client ×
 * service × month, frozen when the month closes.
 */
export async function getClientProfit(): Promise<ClientProfitRow[]> {
  const grid = await readTab(TABS.clientProfit);
  const headerIdx = grid.findIndex((r) => r.some((c) => /^months?$/i.test((c ?? "").trim())));
  if (headerIdx === -1) return [];

  const map = headerMap(grid[headerIdx]);
  const ci = {
    month: col(map, "months", "month"),
    client: col(map, "client"),
    service: col(map, "service"),
    intensity: col(map, "intensity"),
    team: col(map, "team members"),
    revenue: col(map, "revenue"),
    people: col(map, "people cost"),
    referral: col(map, "referral fees"),
    acquisition: col(map, "acquisition cost"),
    other: col(map, "other costs"),
    profit: col(map, "client profit"),
    margin: col(map, "client margin"),
  };

  const out: ClientProfitRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const client = (row[ci.client] ?? "").trim();
    if (!client) continue;
    const monthLabel = (row[ci.month] ?? "").trim();
    const revenue = parseNumber(row[ci.revenue]) ?? 0;
    const profit = parseNumber(row[ci.profit]) ?? 0;
    out.push({
      monthIso: parseMonthLabel(monthLabel),
      monthLabel,
      client,
      service: (row[ci.service] ?? "").trim(),
      intensity: (row[ci.intensity] ?? "").trim(),
      teamMembers: (row[ci.team] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      revenue,
      peopleCost: parseNumber(row[ci.people]) ?? 0,
      referralFees: parseNumber(row[ci.referral]) ?? 0,
      acquisitionCost: parseNumber(row[ci.acquisition]) ?? 0,
      otherCosts: parseNumber(row[ci.other]) ?? 0,
      profit,
      margin: parseNumber(row[ci.margin]) ?? (revenue !== 0 ? profit / revenue : null),
    });
  }
  return out;
}
