"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { MultiSelectFilter, matchesFilter } from "@/components/ui/MultiSelectFilter";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TxRow = {
  date: string;
  /** Sortable key — the ISO month, since raw dates vary in format. */
  monthIso: string | null;
  type: string;
  contact: string;
  description: string;
  category: string;
  account: string;
  amount: number;
};

type SortKey = "date" | "contact" | "amount";

/**
 * Every ledger line in one place. Filters cover the four things people actually
 * search by: type, category, contact and account.
 */
export function TransactionTable({ rows }: { rows: TxRow[] }) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [desc, setDesc] = useState(true);

  const opts = useMemo(
    () => ({
      types: [...new Set(rows.map((r) => r.type).filter(Boolean))].sort(),
      categories: [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(),
      contacts: [...new Set(rows.map((r) => r.contact).filter(Boolean))].sort(),
      accounts: [...new Set(rows.map((r) => r.account).filter(Boolean))].sort(),
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.description} ${r.contact} ${r.category}`.toLowerCase().includes(q)) {
        return false;
      }
      if (opts.types.length > 0 && !matchesFilter(types, r.type)) return false;
      if (opts.categories.length > 0 && !matchesFilter(categories, r.category)) return false;
      if (opts.contacts.length > 0 && !matchesFilter(contacts, r.contact)) return false;
      if (opts.accounts.length > 0 && !matchesFilter(accounts, r.account)) return false;
      return true;
    });
  }, [rows, query, types, categories, contacts, accounts, opts]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === "contact") cmp = a.contact.localeCompare(b.contact);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else cmp = (a.monthIso ?? "").localeCompare(b.monthIso ?? "") || a.date.localeCompare(b.date);
      return desc ? -cmp : cmp;
    });
    return out;
  }, [filtered, sortKey, desc]);

  const total = sorted.reduce((a, r) => a + r.amount, 0);
  const shown = sorted.slice(0, 500);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  function Th({
    label,
    sortBy,
    align = "left",
  }: {
    label: string;
    sortBy?: SortKey;
    align?: "left" | "right";
  }) {
    const active = sortBy === sortKey;
    return (
      <th
        onClick={sortBy ? () => toggleSort(sortBy) : undefined}
        className={cn(
          "sticky-bg border-b border-border/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
          align === "right" ? "text-right" : "text-left",
          sortBy && "cursor-pointer select-none",
        )}
      >
        <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
          {label}
          {sortBy &&
            (active ? (
              desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            ))}
        </div>
      </th>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, contact…"
          className="w-56 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {opts.types.length > 1 && (
          <MultiSelectFilter eyebrow="Type" width="w-44" options={opts.types} selected={types} onChange={setTypes} />
        )}
        {opts.categories.length > 1 && (
          <MultiSelectFilter eyebrow="Category" options={opts.categories} selected={categories} onChange={setCategories} />
        )}
        {opts.contacts.length > 1 && (
          <MultiSelectFilter eyebrow="Contact" options={opts.contacts} selected={contacts} onChange={setContacts} />
        )}
        {opts.accounts.length > 1 && (
          <MultiSelectFilter eyebrow="Account" width="w-52" options={opts.accounts} selected={accounts} onChange={setAccounts} />
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {sorted.length} of {rows.length} · net {formatCurrency(total, { compact: true })}
          {sorted.length > shown.length && ` · showing first ${shown.length}`}
        </span>
      </div>

      <div className="max-h-[620px] overflow-auto rounded-xl border border-border/40">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-30">
              <Th label="Date" sortBy="date" />
              <Th label="Type" />
              <Th label="Contact" sortBy="contact" />
              <Th label="Description" />
              <Th label="Category" />
              <Th label="Account" />
              <Th label="Amount" sortBy="amount" align="right" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : (
              shown.map((r, i) => (
                <tr key={i} className="border-t border-border/30 hover:bg-white/[0.06]">
                  <td className="whitespace-nowrap px-3 py-1.5 text-[12px] tabular-nums text-muted-foreground">
                    {r.date}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        /revenue/i.test(r.type)
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300",
                      )}
                    >
                      {r.type || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[13px] font-medium">
                    <span className="block max-w-[160px] truncate" title={r.contact}>
                      {r.contact || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                    <span className="block max-w-[280px] truncate" title={r.description}>
                      {r.description || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                    <span className="block max-w-[150px] truncate" title={r.category}>
                      {r.category || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                    <span className="block max-w-[140px] truncate" title={r.account}>
                      {r.account || "—"}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 text-right text-[13px] tabular-nums",
                      r.amount < 0 && "text-emerald-300",
                    )}
                  >
                    {formatCurrency(r.amount, { compact: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
