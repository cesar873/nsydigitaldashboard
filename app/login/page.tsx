import { CLIENT_CONFIG } from "@/lib/config";

export const metadata = { title: "Sign in · Finance Dashboard" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 text-center">
          {/* Same wordmark as the nav, which the gate hides. */}
          <span className="agencfo-logo">
            <span>{CLIENT_CONFIG.clientName}</span>
            <span className="x">×</span>
            <span>AGEN</span>
            <span className="cfo">CFO</span>
          </span>
          <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Finance dashboard
          </p>
        </div>

        <form
          action="/api/login"
          method="POST"
          className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 backdrop-blur"
        >
          <input type="hidden" name="from" value={from ?? "/"} />

          <label
            htmlFor="password"
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            required
            className="mt-1.5 w-full rounded-xl border border-border bg-black/30 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[color:var(--blue)]"
            placeholder="Enter password"
          />

          {error && (
            <p className="mt-2.5 text-[12px] text-[color:var(--red)]">
              That password is not right. Try again.
            </p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-[color:var(--blue)] px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          This dashboard shows live financial data. Do not share the password.
        </p>
      </div>
    </div>
  );
}
