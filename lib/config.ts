/** Per-client template config. Swap these when cloning the template. */
export const CLIENT_CONFIG = {
  /** Left half of the nav wordmark. */
  clientName: "NSY DIGITAL",
  /** Shown in the "Live from <sheetName>" footer. */
  sheetName: "NSY Digital v4.2",
  sheetId: process.env.GOOGLE_SHEET_ID ?? "",
  get sheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`;
  },
};

/** Exact Google Sheet tab names, verified against the live sheet. */
export const TABS = {
  clients: "Clients",
  services: "Services",
  people: "People",
  invoices: "Invoices",
  /** Actuals + forecast P&L. */
  financeModel: "Finance Model",
  /** Plan / budget P&L — same shape as Finance Model. */
  financePlan: "Finance Plan",
  profitMatrix: "Profit Matrix",
  clientProfit: "Client Profit",
  teamProfit: "Team Profit",
  transactions: "Transactions",
  bookkeeping: "Bookkeeping",
  balanceSheet: "Balance Sheet",
  legend: "Legend",
} as const;

/** Phase 2 = forecast months visible across every tab. */
export const PHASE = 2 as 1 | 2 | 3;
export const FORECAST_LOOKAHEAD_MONTHS = 3;
