"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CLIENT_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/forecast", label: "Forecast" },
  { href: "/financials", label: "Financials" },
  { href: "/revenue", label: "Revenue" },
  { href: "/expenses", label: "Expenses" },
  { href: "/analytics", label: "Analytics" },
  { href: "/clients", label: "Clients" },
  { href: "/people", label: "People" },
  { href: "/payments", label: "Payments" },
];

/** Global filters persist across tabs; page-specific params are dropped. */
const PRESERVED = ["months", "from", "to", "ccy"];

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // No nav on the login screen — every link behind it is gated anyway.
  const hidden = pathname === "/login";

  const carried = new URLSearchParams();
  for (const key of PRESERVED) {
    const v = searchParams.get(key);
    if (v) carried.set(key, v);
  }
  const qs = carried.toString();

  if (hidden) return null;

  return (
    <div className="border-b border-[var(--card-border)] bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-black/20">
      <div className="mx-auto flex max-w-[1400px] items-center px-9 py-5">
        <Link href={`/forecast${qs ? `?${qs}` : ""}`} className="agencfo-logo">
          <span>{CLIENT_CONFIG.clientName}</span>
          <span className="x">×</span>
          <span>AGEN</span>
          <span className="cfo">CFO</span>
        </Link>

        <nav className="ml-auto flex items-center overflow-x-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={`${link.href}${qs ? `?${qs}` : ""}`}
                className={cn(
                  "anton relative px-3 py-1.5 text-xs tracking-[1px] md:px-5 md:py-3 md:text-[15px] md:tracking-[1.5px]",
                  active
                    ? "text-[color:var(--blue)]"
                    : "text-[color:var(--muted)] hover:text-foreground",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-px left-3 right-3 h-0.5 bg-[color:var(--blue)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
