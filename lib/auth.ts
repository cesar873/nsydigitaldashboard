/**
 * Shared-password gate for the whole dashboard.
 *
 * Every page reads a client's live P&L, payroll and cash position, so the app
 * gates itself rather than relying on a hosting-provider setting — this way the
 * gate travels with the repo to every client deployment instead of having to be
 * re-applied by hand in a dashboard.
 *
 * Uses Web Crypto only (no `node:crypto`), so the same helpers run in
 * middleware on the Edge runtime and in route handlers on Node.
 */

export const COOKIE_NAME = "agencfo_session";

/** Bumping this invalidates every issued cookie. */
const MARKER = "agencfo-dashboard-v1";

/**
 * The cookie carries an HMAC of a fixed marker keyed by the password — never
 * the password itself. It cannot be forged without knowing the password, and
 * reading it back off a client reveals nothing reusable elsewhere.
 */
export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(MARKER));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare, so a wrong guess leaks nothing through timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
