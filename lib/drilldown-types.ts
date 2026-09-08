/**
 * Drill-down request/response shapes, kept free of any sheet or server imports
 * so client components can type against them without pulling google-auth-library
 * into the browser bundle.
 *
 * Scope is deliberately narrow: client movement only. Signed and lost counts are
 * a count of Services start/end dates, so the popup always sums to the number
 * that was clicked.
 */
export type DrillDimension = "clientsSigned" | "clientsLost";

export type DrillRequest = {
  dimension: DrillDimension;
  /** ISO months in scope. */
  months: string[];
};

export type DrillRow = {
  /** The client's start or end date, as the sheet shows it. */
  date: string;
  client: string;
  service: string;
  detail: string;
  month: string;
};

export type DrillResult = {
  title: string;
  subtitle: string;
  source: string;
  note: string;
  rows: DrillRow[];
  total: number;
};
