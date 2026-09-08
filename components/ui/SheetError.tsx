import { AlertCircle } from "lucide-react";

/**
 * Shown when the Sheets read fails. Names the tab and the likely cause rather
 * than rendering a page full of em-dashes (tabs.md Appendix C).
 */
export function SheetError({ error, tab }: { error: unknown; tab: string }) {
  const message = error instanceof Error ? error.message : String(error);
  const isAuth = /GOOGLE_|credential|invalid_grant|unauthorized|401|403/i.test(message);
  const isMissingTab = /not found|Unable to parse range|400/i.test(message);

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
      <div className="rounded-xl border border-[var(--red)]/30 bg-[var(--red)]/[0.04] p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[color:var(--red)]" />
          <h1 className="text-base font-semibold">Couldn&apos;t read “{tab}”</h1>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">
          {isAuth
            ? "The service account credentials are missing or rejected. Copy .env.local.example to .env.local, fill in GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, and confirm the sheet is shared with that service account as Viewer."
            : isMissingTab
              ? `The sheet has no tab named “${tab}”. Update the TABS map in lib/config.ts to the exact tab name, then reload.`
              : "The sheet read failed for an unexpected reason."}
        </p>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-black/30 p-3 text-[11px] text-muted-foreground">
          {message}
        </pre>
      </div>
    </div>
  );
}
