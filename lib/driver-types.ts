/**
 * Driver types and the pure "am I on track" maths. Deliberately free of any
 * sheet or server imports so client components can use them without Turbopack
 * tracing google-auth-library into the browser bundle.
 */
export type DriverKey = "revenue" | "profit" | "clients" | "signed" | "lost" | "retainer";

export type DriverMonth = {
  monthIso: string;
  target: number;
  /** Live from the Services roster, so signing a client today moves it today. */
  actual: number;
  /** Closed month, the month in progress, or still ahead. */
  phase: "closed" | "current" | "upcoming";
};

export type Driver = {
  key: DriverKey;
  label: string;
  unit: "count" | "currency";
  /** Shown as a card on the board, as well as a row in the table. */
  onBoard?: boolean;
  /** Where the live actual comes from, surfaced under the row label. */
  sourceNote?: string;
  /** Lower is better — the churn allowance. */
  inverse?: boolean;
  /**
   * A flow accumulates across the year, so a miss carries forward. A level
   * (average retainer) is judged month by month and never carries.
   */
  carries: boolean;
  months: DriverMonth[];
};

export type DriverStatus = "ahead" | "on" | "at-risk" | "behind" | "pending";

export type DriverView = {
  driver: Driver;
  month: DriverMonth;
  status: DriverStatus;
  /** Plan cumulative through the focused month. */
  cumTarget: number;
  /**
   * Actual cumulative through whichever comes first, the focused month or the
   * month in progress — a month that has not happened has no shortfall.
   */
  cumActual: number;
  /** False when the focused month is still ahead, so the two aren't comparable. */
  cumComparable: boolean;
  /** Shortfall carried in from earlier months (0 when caught up or ahead). */
  carriedIn: number;
  /** Month target plus anything carried in — what it really takes to catch up. */
  requiredThisMonth: number;
  /** Still to do this month against `requiredThisMonth`. */
  remaining: number;
};

/**
 * Everything needed to answer "am I on track" for one driver in one month,
 * including the carry-over that stops a bad month quietly resetting.
 */
export function viewDriver(driver: Driver, monthIso: string): DriverView | null {
  const idx = driver.months.findIndex((m) => m.monthIso === monthIso);
  if (idx === -1) return null;
  const month = driver.months[idx];

  const upTo = driver.months.slice(0, idx + 1);
  const before = driver.months.slice(0, idx);

  const cumTarget = upTo.reduce((a, m) => a + m.target, 0);
  // Only elapsed months contribute actuals; an upcoming month is not a miss.
  const elapsedUpTo = upTo.filter((m) => m.phase !== "upcoming");
  const cumActual = elapsedUpTo.reduce((a, m) => a + m.actual, 0);
  const cumComparable = month.phase !== "upcoming";

  // Only closed months can carry a shortfall; the month in progress cannot.
  const closedBefore = before.filter((m) => m.phase === "closed");
  const priorTarget = closedBefore.reduce((a, m) => a + m.target, 0);
  const priorActual = closedBefore.reduce((a, m) => a + m.actual, 0);
  const rawCarry = driver.inverse ? priorActual - priorTarget : priorTarget - priorActual;
  const carriedIn = driver.carries ? Math.max(0, rawCarry) : 0;

  const requiredThisMonth = driver.carries
    ? driver.inverse
      ? Math.max(0, month.target - carriedIn)
      : month.target + carriedIn
    : month.target;

  const remaining = driver.inverse
    ? requiredThisMonth - month.actual
    : Math.max(0, requiredThisMonth - month.actual);

  // `behind` (red) means the chance has gone: a closed month that missed, or an
  // allowance already blown. Anything still winnable this month is `at-risk`.
  let status: DriverStatus;
  const closed = month.phase === "closed";

  if (driver.inverse) {
    const over = month.actual > requiredThisMonth;
    status = over ? "behind" : month.actual < requiredThisMonth ? "ahead" : "on";
  } else if (requiredThisMonth === 0) {
    status = month.actual > 0 ? "ahead" : "on";
  } else {
    const ratio = month.actual / requiredThisMonth;
    if (ratio > 1) status = "ahead";
    else if (ratio === 1) status = "on";
    else status = closed ? "behind" : "at-risk";
  }

  if (month.phase === "upcoming" && status !== "ahead" && status !== "on") {
    status = "at-risk";
  }

  return {
    driver,
    month,
    status,
    cumTarget,
    cumActual,
    cumComparable,
    carriedIn,
    requiredThisMonth,
    remaining,
  };
}

/** Fraction of the month gone, so a mid-month number can be read against pace. */
export function monthElapsedFraction(monthIso: string, today: Date): number {
  const [y, m] = monthIso.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const end = Date.UTC(y, m, 1);
  const now = today.getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now - start) / (end - start);
}
