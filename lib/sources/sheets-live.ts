import { JWT } from "google-auth-library";
import { CLIENT_CONFIG } from "@/lib/config";

export type Grid = string[][];

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CACHE_TTL_MS = 60_000;

type CacheEntry = { at: number; grid: Grid };

/**
 * Held on globalThis, not as a module constant. Next puts route handlers and
 * page components in separate module instances, so a plain module-level Map
 * would give the Refresh route its own copy and clearing it would do nothing to
 * what the pages read.
 */
const globalCache = globalThis as unknown as {
  __sheetCache?: Map<string, CacheEntry>;
};
const cache: Map<string, CacheEntry> = (globalCache.__sheetCache ??= new Map());

let clientPromise: Promise<JWT> | null = null;

/**
 * Resolves the service-account email + private key from the environment.
 *
 * Preferred: GOOGLE_CREDENTIALS holds the *entire* service-account JSON (paste
 * the file straight from Google Cloud). Falls back to the split
 * GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY pair so older deployments
 * keep working. Either way the private key's literal `\n` sequences — how
 * Vercel and .env files store newlines — are turned back into real newlines.
 */
function loadServiceAccount(): { email: string; key: string } {
  const json = process.env.GOOGLE_CREDENTIALS;
  if (json && json.trim()) {
    let creds: { client_email?: string; private_key?: string };
    try {
      creds = JSON.parse(json);
    } catch {
      throw new Error(
        "GOOGLE_CREDENTIALS is set but is not valid JSON. Paste the entire " +
          "service-account JSON (the whole file) as the value.",
      );
    }
    const email = creds.client_email;
    const key = creds.private_key;
    if (!email || !key) {
      throw new Error(
        "GOOGLE_CREDENTIALS JSON is missing client_email or private_key.",
      );
    }
    return { email, key: key.replace(/\\n/g, "\n") };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_CREDENTIALS to the full " +
        "service-account JSON, or set GOOGLE_SERVICE_ACCOUNT_EMAIL and " +
        "GOOGLE_PRIVATE_KEY. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  return { email, key: rawKey.replace(/\\n/g, "\n") };
}

function getClient(): Promise<JWT> {
  if (!clientPromise) {
    const { email, key } = loadServiceAccount();
    const jwt = new JWT({ email, key, scopes: SCOPES });
    clientPromise = jwt.authorize().then(() => jwt);
  }
  return clientPromise;
}

/** Reads a whole tab as a raw string grid. Cached 60s per tab. */
export async function readTab(tabName: string): Promise<Grid> {
  const hit = cache.get(tabName);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.grid;

  const client = await getClient();
  const range = encodeURIComponent(`${tabName}`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CLIENT_CONFIG.sheetId}/values/${range}` +
    `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const res = await client.request<{ values?: unknown[][] }>({ url });
  const values = res.data.values ?? [];
  const grid: Grid = values.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));

  cache.set(tabName, { at: Date.now(), grid });
  return grid;
}

/** Lists the sheet's tab names — used to verify TABS against the live sheet. */
export async function listTabNames(): Promise<string[]> {
  const client = await getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLIENT_CONFIG.sheetId}?fields=sheets.properties.title`;
  const res = await client.request<{ sheets?: { properties?: { title?: string } }[] }>({ url });
  return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

export function clearSheetCache() {
  cache.clear();
}
