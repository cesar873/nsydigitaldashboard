import { TABS } from "@/lib/config";
import { listTabNames } from "./sheets-live";

/**
 * Scenarios are sheet tabs, so the picker is driven by the sheet itself.
 * Any tab that reads as a plan variant qualifies; "Finance Model" is excluded
 * because it is the actuals/run-rate source, not a scenario.
 */
const SCENARIO_PATTERN = /^finance\s+(plan|scenario|budget|target)/i;

export type Scenario = { tab: string; label: string };

/**
 * A short picker label. A parenthetical case wins — "Finance Plan (Base)" reads
 * as "Base", "Finance Plan (Optimistic)" as "Optimistic". Otherwise just drop
 * the "Finance " prefix, so "Finance Scenario B" stays "Scenario B".
 */
function scenarioLabel(tab: string): string {
  const paren = tab.match(/\(([^)]+)\)\s*$/);
  if (paren) return paren[1].trim();
  return tab.replace(/^finance\s+/i, "").trim();
}

export async function listScenarios(): Promise<Scenario[]> {
  const tabs = await listTabNames();
  const found = tabs
    .filter((t) => t !== TABS.financeModel && SCENARIO_PATTERN.test(t))
    .map((tab) => ({ tab, label: scenarioLabel(tab) }));

  // Always offer the canonical plan tab, even if it were renamed out of pattern.
  if (found.length === 0 && tabs.includes(TABS.financePlan)) {
    return [{ tab: TABS.financePlan, label: "Plan" }];
  }
  return found;
}

export function resolveScenario(scenarios: Scenario[], requested?: string): Scenario | null {
  if (scenarios.length === 0) return null;
  return scenarios.find((s) => s.tab === requested) ?? scenarios[0];
}
