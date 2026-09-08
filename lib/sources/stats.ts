import { TABS } from "@/lib/config";
import { parseMonthLabel } from "@/lib/months";
import { readTab } from "./sheets-live";

/** Stats tab: key/value rows. "Last Actual Month" → ISO month. */
export async function getLastActualMonth(): Promise<string | null> {
  try {
    const grid = await readTab(TABS.legend);
    for (const row of grid) {
      if (/last actual month/i.test((row[0] ?? "").trim())) {
        return parseMonthLabel(row[1] ?? "");
      }
    }
  } catch {
    // Stats tab is optional — callers fall back to latest non-zero month.
  }
  return null;
}
