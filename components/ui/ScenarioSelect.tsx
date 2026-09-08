"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PopoverSelect } from "./PopoverSelect";
import type { Scenario } from "@/lib/sources/scenarios";

export function ScenarioSelect({
  scenarios,
  selected,
}: {
  scenarios: Scenario[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function commit(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    // First scenario is the default, so it stays out of the URL.
    if (tab === scenarios[0]?.tab) params.delete("scenario");
    else params.set("scenario", tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <PopoverSelect
      eyebrow="Scenario"
      options={scenarios.map((s) => ({ value: s.tab, label: s.label }))}
      value={selected}
      onChange={commit}
    />
  );
}
