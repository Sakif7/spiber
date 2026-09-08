/**
 * Formatting for printed documents.
 *
 * Deliberately not `formatBDT`: the PDF renderer's built-in fonts have no "৳"
 * glyph, so a currency-formatted string would print a blank box. Documents show
 * a plain grouped number under a "(BDT)" column heading, exactly as the paper
 * invoices do.
 */

/** 8840000 → "88,400". Poisha only appear when the amount has some. */
export function formatTaka(minor: number): string {
  const taka = Math.floor(Math.abs(minor) / 100);
  const poisha = Math.abs(minor) % 100;
  const sign = minor < 0 ? "-" : "";
  const grouped = groupBd(taka);
  return poisha === 0
    ? `${sign}${grouped}`
    : `${sign}${grouped}.${String(poisha).padStart(2, "0")}`;
}

/**
 * Bangladeshi digit grouping: the last three digits, then pairs.
 * 1234567 → "12,34,567" rather than "1,234,567".
 */
function groupBd(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

/**
 * "14/8/2026" in the Bangladesh calendar, where the document is issued.
 *
 * Composed from parts rather than formatted directly: en-GB pads the month to
 * two digits ("14/08/2026"), and the company's invoices do not.
 */
export function fmtDate(date: Date): string {
  const p = dhakaParts(date);
  return `${p.day}/${p.month}/${p.year}`;
}

function dhakaParts(date: Date): {
  day: number;
  month: number;
  year: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((x) => x.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** "21st July 2026" — how the proposal dates itself. */
export function fmtLongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = Number(get("day"));
  return `${day}${ordinal(day)} ${get("month")} ${get("year")}`;
}

function ordinal(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** The date `days` after `from`, for a payment due date. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
