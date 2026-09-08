/**
 * Payroll months.
 *
 * A payroll month is a Bangladeshi calendar month, not a UTC one. Payroll is a
 * statutory monthly document produced where the company operates, and invoices
 * already print Dhaka dates — so a payment taken at 9pm on the 31st belongs to
 * that month's takings, which a UTC boundary would push into the next.
 *
 * Bangladesh has been at a fixed UTC+6 with no daylight saving since 2009, so
 * the offset can be written directly rather than resolved per date.
 */

/** "2026-08" */
export type PayrollMonth = string;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DHAKA_OFFSET = "+06:00";

export function isPayrollMonth(value: string): value is PayrollMonth {
  return MONTH_RE.test(value);
}

/** The half-open window [start, end) covering `month` in Dhaka time. */
export function monthWindow(month: PayrollMonth): { start: Date; end: Date } {
  if (!isPayrollMonth(month)) {
    throw new Error(`monthWindow: "${month}" is not a YYYY-MM month`);
  }
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(`${month}-01T00:00:00${DHAKA_OFFSET}`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(
    `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00${DHAKA_OFFSET}`,
  );
  return { start, end };
}

/** The month `date` falls in, in Dhaka time. */
export function monthOf(date: Date): PayrollMonth {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

/** The month before `month`. */
export function previousMonth(month: PayrollMonth): PayrollMonth {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

/** The month after `month`. */
export function nextMonth(month: PayrollMonth): PayrollMonth {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

/** `count` months ending at `month`, oldest first. */
export function recentMonths(
  month: PayrollMonth,
  count: number,
): PayrollMonth[] {
  const out: PayrollMonth[] = [];
  let cursor = month;
  for (let i = 0; i < count; i++) {
    out.unshift(cursor);
    cursor = previousMonth(cursor);
  }
  return out;
}

/** "August 2026" */
export function monthLabel(month: PayrollMonth): string {
  const { start } = monthWindow(month);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    month: "long",
    year: "numeric",
  }).format(start);
}
