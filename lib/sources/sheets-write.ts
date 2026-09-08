import { JWT } from "google-auth-library";
import { CLIENT_CONFIG } from "@/lib/config";
import { clearSheetCache } from "./sheets-live";

/**
 * Write access is deliberately separate from the read client: it needs the
 * broader `spreadsheets` scope, and the service account must be shared on the
 * sheet as an Editor rather than a Viewer.
 *
 * Only the cells named by the caller are touched — never a whole row or range.
 */
const WRITE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let clientPromise: Promise<JWT> | null = null;

function getWriteClient(): Promise<JWT> {
  if (!clientPromise) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!email || !rawKey) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.");
    }
    const jwt = new JWT({
      email,
      key: rawKey.replace(/\\n/g, "\n"),
      scopes: WRITE_SCOPES,
    });
    clientPromise = jwt.authorize().then(() => jwt);
  }
  return clientPromise;
}

/** Writes a single cell, e.g. `updateCell("Bookkeeping", "O12", "Software")`. */
export async function updateCell(
  tabName: string,
  cellA1: string,
  value: string,
): Promise<void> {
  const client = await getWriteClient();
  const range = encodeURIComponent(`${tabName}!${cellA1}`);
  await client.request({
    url:
      `https://sheets.googleapis.com/v4/spreadsheets/${CLIENT_CONFIG.sheetId}/values/${range}` +
      `?valueInputOption=USER_ENTERED`,
    method: "PUT",
    data: { values: [[value]] },
  });
  // The cached copy is now stale.
  clearSheetCache();
}

/** Turns a permission error into something a person can act on. */
export function describeWriteError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/permission|forbidden|403|insufficient/i.test(message)) {
    return (
      "The service account cannot write to this sheet. Share the spreadsheet with " +
      `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "the service account"} as an ` +
      "Editor (it currently has Viewer access), then try again."
    );
  }
  return message;
}
