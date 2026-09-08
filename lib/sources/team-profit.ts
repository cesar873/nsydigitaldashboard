import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { col, headerMap, parseNumber } from "@/lib/parse";
import { readTab } from "./sheets-live";

export type TeamProfitRow = {
  monthIso: string | null;
  monthLabel: string;
  name: string;
  department: string;
  salary: number;
  costPerHour: number;
  utilizationTarget: number | null;
  utilizationActual: number | null;
  hoursAvailable: number;
  revenueCovered: number;
  profit: number;
  margin: number | null;
  revenueGap: number;
};

/** The Team Profit tab: one row per person per month, frozen at month end. */
export async function getTeamProfit(): Promise<TeamProfitRow[]> {
  const grid = await readTab(TABS.teamProfit);
  const headerIdx = grid.findIndex((r) => r.some((c) => /^months?$/i.test((c ?? "").trim())));
  if (headerIdx === -1) return [];

  const map = headerMap(grid[headerIdx]);
  const ci = {
    month: col(map, "months", "month"),
    name: col(map, "team member"),
    dept: col(map, "department"),
    salary: col(map, "salary"),
    cost: col(map, "cost per hour"),
    target: col(map, "utilization target"),
    actual: col(map, "utilization actual"),
    hours: col(map, "hours available"),
    covered: col(map, "revenue covered"),
    profit: col(map, "people profit"),
    margin: col(map, "people margin"),
    gap: col(map, "revenue gap"),
  };

  const out: TeamProfitRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const name = (row[ci.name] ?? "").trim();
    if (!name) continue;
    const monthLabel = (row[ci.month] ?? "").trim();
    out.push({
      monthIso: parseMonthLabel(monthLabel),
      monthLabel,
      name,
      department: (row[ci.dept] ?? "").trim(),
      salary: parseNumber(row[ci.salary]) ?? 0,
      costPerHour: parseNumber(row[ci.cost]) ?? 0,
      utilizationTarget: parseNumber(row[ci.target]),
      utilizationActual: parseNumber(row[ci.actual]),
      hoursAvailable: parseNumber(row[ci.hours]) ?? 0,
      revenueCovered: parseNumber(row[ci.covered]) ?? 0,
      profit: parseNumber(row[ci.profit]) ?? 0,
      margin: parseNumber(row[ci.margin]),
      revenueGap: parseNumber(row[ci.gap]) ?? 0,
    });
  }
  return out;
}
