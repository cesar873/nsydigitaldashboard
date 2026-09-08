# AgenCFO Agency Template 4.2

Finance dashboard reading live from a Google Sheet. Built to `formatting.md` (style) and `tabs.md` (structure).

## Conventions

- **The sheet cache lives on `globalThis`**, not as a module constant. Next puts route
  handlers and page components in separate module instances, so a plain module-level Map
  gives `/api/refresh` its own copy and clearing it does nothing to what the pages read.
  This is why Refresh appeared to do nothing until the 60s TTL lapsed.
- **Stacking order is fixed**: nav `z-50`, filter bar `z-40`, sticky table headers and
  totals `z-30`, sticky-left cells `z-20`. A table's sticky furniture must never sit
  above the page chrome.
- **Colour means change, not value.** KPI numbers render plain; only the delta is
  tinted. `deltaInverse` marks metrics where a fall is the good outcome (costs, churn,
  CAC), so a drop there reads green.
- **Red means the chance has gone.** On the Key targets board, a driver is red only
  when a closed month missed or a churn allowance was blown. Anything still winnable
  this month — or still ahead — is amber. Green is reserved for actually ahead.

- **Nav order** is Forecast · Financials · Revenue · Expenses · Analytics · Clients · People · Payments; `/` redirects to `/forecast`.
- **Default range** is Jan → Dec of the planning year (the calendar year the last
  actual month falls in), so it stays correct as the sheet rolls forward.
- **Forecast months render as a lighter tint of the series' own colour**
  (`lighten()` in `chart-shared.ts` — blue → `#95cdf6`, green → `#9ce5b7`), dashed.
  Line/area series split into an actuals key and a `__fc` key sharing the boundary
  point, so the tail draws without a gap. Bars recolour per cell.
- **`MonthMatrixTable`** is the shared rows × months table behind revenue-by-client,
  cost-by-category and all-costs. Primary/secondary/status columns are always
  visible; anything passed as `detailColumns` hides behind "Show details". Every
  month column sorts, filters are true multi-selects (All / None / only), and rows
  with no value in the selected range are hidden by default (`hideEmptyRows`).

## Drill-down

Scoped to one place: the **Signed & lost client bars on Analytics**. Clicking a bar
lists the clients behind the count, resolved from the Services tab's start / end
dates — the same source the count comes from, so the list always reconciles with
the number clicked.

`lib/sources/drilldown.ts` behind `POST /api/drilldown`; the Services tab is already
cached in memory, so this is a filter, not a fetch.

Drill-downs on revenue, expense and Budget vs Actual figures were built and then
removed — too fragile to be worth it while the model's sources aren't reconciled.

**Client-safe type modules.** `lib/drilldown-types.ts`, `lib/metrics.ts` and
`lib/driver-types.ts` exist solely so client components can import these types and
pure helpers without Turbopack tracing `google-auth-library` into the browser bundle.
A `"use client"` file must never import from `lib/sources/*` — not even `import type`,
which Turbopack still follows. This has bitten three times; check it first when a page
500s with "Can't resolve 'fs' / 'child_process'".

## Run

```bash
npm run dev    # http://localhost:3100
```

## Setup for a new client

1. `cp .env.local.example .env.local` and fill in the service-account values.
2. Share the client's sheet with the service account email as **Viewer**.
3. Edit `lib/config.ts`: `clientName`, `sheetName`, and the `TABS` map.
4. Set `PHASE` in `lib/config.ts` (1 = actuals only, 2 = forecast visible, 3 = profitability tabs).

Service-account key lives outside the repo at `~/.config/agencfo/`. Never commit it.

## Verified tab names (v4.2 sheet)

`Clients` · `Services` · `People` · `Invoices` · `Finance Model` · `Finance Plan` ·
`Profit Matrix` · `Client Profit` · `Team Profit` · `Transactions` · `Bookkeeping` ·
`Balance Sheet` · `Legend`

`Finance Model` is the actuals+forecast P&L. `Finance Plan` is the same shape holding
plan/budget. `Legend` carries `Last Actual Month`. Note that `Finance Model` also
contains a Balance Sheet Summary block (`TOTAL CASH`, `Accounts Receivable`, …) and a
Metrics block (`Burn Rate`, `Churn Rate`, `Churn MRR`, `Lifetime Value`, `CAC`,
`Revenue per Employee`) — Phase 2 Analytics reads from there, not a separate tab.

## Built (Phase 1)

| Route | Sources |
|---|---|
| `/financials` | Finance Model |
| `/revenue` | Services |
| `/revenue` | Services |
| `/expenses` | Transactions + Finance Model |
| `/forecast` | Finance Model vs a scenario tab (Finance Plan) |
| `/analytics` | Finance Model (Metrics + driver rows) |
| `/clients` | Client Profit |
| `/people` | Team Profit |
| `/payments` | Invoices + Bookkeeping |

## Forecast tab

Puts `Finance Model` (reality + run rate) against a scenario tab (the budget).
Uses the standard Period + Range filters, defaulting to Jan → Dec of the planning
year; the Range drives both the chart and the Budget vs Actual table, while the
scorecard stays anchored to the full calendar year so "FY planned" keeps its meaning.

- **Scenario select** is driven by the sheet: any tab matching
  `/^finance (plan|scenario|budget|target)/i` becomes an option, so adding
  "Finance Scenario B" to the sheet adds it to the picker with no code change.
- **One scorecard row** carries everything: KPI box styling shared with the other
  tabs (label, Anton value, delta vs plan YTD) plus the plan context — status chip,
  a pace bar with two markers, and FY run rate / planned / difference. There is no
  separate Goal Progress section; it was merged in to avoid two near-identical rows.
- **Status answers one question only: where are we now.** YTD actual against the
  plan's own schedule to date, with a 2% dead band so an exact hit reads "On plan",
  not "Ahead". It deliberately says nothing about the rest of the year — the Finance
  Model only carries contracted revenue, so a full-year gap is expected, not a risk.
- **The gap to the goal is split into two lines** on each tile: `To go to goal`
  (full-year plan less booked to date) and `Already contracted` (how much of that
  the current book already covers), with `Still to win` as the remainder. That is the
  actionable half — a "Gap to close" line rather than a red badge. A fixed cost like
  Owner Drawing shows 100% contracted and no gap, because the rest of the year is
  already in the model and needs no new clients won.
  The section header names which goals are off track.
- **Plan vs actual chart** (full width) plots cumulative actual against cumulative
  plan as smooth areas; the gap between them is the story. The **plan spans the whole
  range** — it is a target, known for every month — while only the actual splits at
  the last actual month and continues as a lighter dashed tint. Data labels sit on the *outside*
  of each line (plan above, actual below) — inside the gap they collide as the lines
  diverge. `fill` must be a LabelList prop, not `style`: Recharts writes its own
  `fill` attribute and would override it.
- **Key targets** turns the plan into operating drivers: total revenue, total clients,
  clients to sign, churn allowance and average retainer as cards, plus operating
  profit in the table. Each row states where its actual comes from — revenue and the
  client drivers are live off Services; profit reads the Finance Model, since Services
  cannot produce a profit figure. Targets come from the
  scenario's driver rows; **actuals are live off the Services roster**, so signing or
  losing a client today moves the board today — no month-end wait.
  - A **month strip** gives full-year context and one-click access to next month.
    The month containing today is marked `live` and shows how much of it has elapsed,
    so a mid-month number reads against pace.
  - **A miss carries forward.** `requiredThisMonth = month target + shortfall carried
    in from earlier closed months`, so churning too many in March still shows up in
    April. The card says so explicitly when a carry is included.
  - **A month that hasn't happened is not a shortfall.** Upcoming months render as
    `pending` / `—` rather than a deficit; only elapsed months contribute actuals.
    The month in progress does count — being 0 of 7 on the 5th genuinely is behind.
- **Targets by month** is the CFO view: each cell is actual-over-target with a bar
  that fills to the target line and overshoots when ahead, so a miss reads without
  comparing numbers. The Year column shows progress toward the annual figure, and its
  gap is the position *as of today* — elapsed actual vs elapsed target for a flow,
  latest level vs that month's target for a level. Never full-year target against
  part-year actual.
- **Budget vs Actual** is laid out as a real P&L: each section heading (Revenue,
  Cost of sales, Operating expenses, Other expenses) carries its own TOTAL figures in
  bold, with the breakdown indented beneath it, and Gross / Operating / Net profit each
  followed by their margin row. Sections are separated by spacing. Hovering a cell
  highlights its row and whole month block; clicking a month header pins that column.
  Columns follow the global Range, and the full-year column is pinned right so it
  survives horizontal scrolling.
- **Two toggles.** View: `Actuals` (one column per period), `vs Budget`
  (Bud · Act · % · $) or `vs Last year` (same period a year earlier). Grain: `Monthly`
  or `Quarterly`, summing calendar quarters — margins average rather than sum, and a
  quarter only counts as actual once every month in it has closed.
- **Forecast periods stay visibly separate in every view**, including `Actuals`:
  italic, muted, and crosshatched in grey, with an `fcst` tag on the header. The
  Actuals view is the expected trend, not a record of what happened.
- The **Full year** block carries the same sub-columns as every period, so it reads
  the same way, and is pinned right.

## Tab contents

**Financials** — P&L KPIs, revenue/profit and margin trends, a 2×2 balance grid (cash,
receivables, credit card, owner pay), then year-over-year: one card per year for the
last three, plus a **normalised chart** inside the same card block that plots any metric across
every year on a shared Jan–Dec axis, so the years overlay rather than run end to end.
Its metric picker sits on the plot, series use distinct hues rather than shades of one
blue, and every point is labelled. Ends with **All
transactions** — the full ledger, filterable by type, category, contact and account — each filter with more than eight
options gets a type-to-search box.

**Revenue** — KPIs, revenue by service line, snapshot breakdowns by service/intensity/
source, then the full client × service × month matrix. Client, Service and Status are
always visible; Intensity, Source, Start and End sit behind "Show details".

**Expenses** — KPIs, cost by category stacked bars, the category × month matrix from
the Finance Model with a `% of revenue` toggle, and **All costs**: every vendor ×
category from the Transactions ledger with search and a category filter.

## Analytics tab

Unit economics, all from the Finance Model's Metrics block and driver rows.
KPI strip → LTV vs CAC → Churn → Signed & lost clients → every metric by month.

**The sheet's `Lifetime Value` row holds a lifetime in MONTHS, not currency** —
its values are `1 / Churn Rate` (churn 6.67% → 15). It is surfaced as
"Lifetime (months)", and money LTV is derived as `avg invoice × lifetime months`
so that LTV/CAC compares like with like. Avg invoice is itself derived
(`TOTAL REVENUE / total clients`) — the sheet carries no such row.

Months where churn is zero leave the lifetime row at 0, so LTV and LTV/CAC read
`—` for those months rather than infinity.

## Clients · People · Payments

Backward-looking rollups, rebuilt to the original dashboard's layout.

**Clients** reads the `Client Profit` tab: KPI strip, average margin by month, margin
by service and by intensity, then the client × service table with in-cell bars and a
grand total. The original had a "Pod" dimension; this sheet has **Intensity** instead,
so that is what the second breakdown uses.

**People** reads `Team Profit`: revenue covered, utilisation, people on target, revenue
gap and billable hours, plus utilisation and hours by department, then the per-person
table with a target tick on each utilisation bar. Utilisation averages count only roles
that actually carry a target.

**Payments** reads `Invoices` for AR and `Bookkeeping` (columns F–P) for the
clarification queue. Five KPIs, a pipeline panel that toggles between unsent invoices
and uncategorised transactions, and an outstanding panel with the unpaid / partially
paid split and an aged list. `Days Overdue` is empty in the sheet, so it is derived
from the due date.

**Payments writes back.** The Category picker and Comment box on the Transactions view
save straight into the Bookkeeping tab — Category to column **O**, Comment to column
**P**, on the transaction's own row. Options come from the distinct **High Category**
values in the chart of accounts (column D).

This is the only place the dashboard mutates the sheet. It uses a separate client in
`lib/sources/sheets-write.ts` with the broader `spreadsheets` scope, and only ever
writes the single cell it names — never a range or a whole row. A failed write rolls
the value back on screen so the UI never disagrees with the sheet, and a permission
error explains exactly which sharing setting to change. Invoice Approve / Status
actions from the original design are not built; those change invoice state rather than
annotate a row.

Both `Client Profit` and `Team Profit` currently hold a **single month**, since they are
append-only rollups that grow as months close. The month-over-month chart will fill in
as more months are appended.

## Deviations from tabs.md

- **Financials** has no Budget vs Actual table yet. `Finance Plan` is the budget source —
  wiring it is the next step.
- **Revenue** breaks down by Service / Intensity / Source. The sheet has no Industry or Pod.
- **Expenses** stacks by category from the transaction ledger, not by department — costs
  carry no department allocation. A vendor table replaces the vendor × month grid.
- No drilldown routes: there is no Time Tracking tab, matching the tabs.md default.

## Known data gaps in the sheet

These are sheet-side, not dashboard bugs. The dashboard reports them rather than hiding them.

- `TOTAL COST OF SALES` is 0 for Aug 2026 (Jul was $18,091), so gross margin reads 100%
  and operating profit is overstated for the latest actual month.
- 1,963 of 2,672 `Transactions` rows are flagged `MISSING` in the `Check` column. They are
  still counted, but their category mapping is unverified.
- Aug 2026 revenue is $78.4K per `Services` vs $71.7K per `Finance Model` — a ~$6.7K
  reconciliation gap between the two tabs.
- The ledger's expense rows are **signed**: a negative Net on an "Expense" row is a
  refund (`Receive Money`) and renders green, as an inflow. There are 42 such rows.
  Absolute-valuing them would show a refund as a second expense.
- `Other Expense` (Finance Model) carries its own mostly-zero values, so it reads as a
  data row rather than a section header. Expense grouping is therefore positional:
  anything below `TOTAL OPERATING EXPENSES` is treated as a non-operating cost. If that
  row were blanked out it would be detected as a header automatically.
Rows are read by label, never by index, and duplicate labels are summed to match the
sheet's own totals. A duplicated `Media Buyers` row in `Finance Plan` was found and
removed on 2026-09-01; Jan 2026 now reconciles exactly across all four P&L lines.
