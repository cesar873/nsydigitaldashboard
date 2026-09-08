import { TABS } from "@/lib/config";
import { listTabNames } from "./sheets-live";

/**
 * Scenarios are sheet tabs, so the picker is driven by the sheet itself.
 * Any tab that reads as a plan variant qualifies; "Finance Model" is excluded
 * because it is the actuals/run-rate source, not a scenario.
 */
const SCENARIO_PATTERN = /^finance\s+(plan|scenario|budget|target)/i;

export type Scenario = { tab: string; label: string };

export async function listScenarios(): Promise<Scenario[]> {
  const tabs = await listTabNames();
  const found = tabs
    .filter((t) => t !== TABS.financeModel && SCENARIO_PATTERN.test(t))
    .map((tab) => ({ tab, label: tab.replace(/^finance\s+/i, "") }));

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
