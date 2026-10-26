/**
 * Pay cycles: how time is cut into periods.
 *
 * Two parts of payroll run on a cycle, and they are set separately. The
 * PROFIT cycle (one for the company) is how often profit is worked out and
 * split between the shareholders — each period stands alone, so a longer one
 * lets its good months cover its bad ones. A PAY SCHEDULE is when people get
 * the money: a payout pays everything earned and not yet paid. Both are this
 * same shape.
 *
 * Pure and DB-free: the services, the pages and the forms all import it.
 *
 * Every period is a run of whole Bangladeshi calendar days, [start, end) — a
 * payment taken at 9pm on the 15th belongs to the first half of the month,
 * which a UTC boundary would push into the second (see `months.ts`). Days are
 * "YYYY-MM-DD" strings and only become instants at the edge, in `dayStart`.
 *
 * A cycle can change. Each change is a version that applies from a day, and
 * the last period of the old version is cut short where the new one begins,
 * so a period already worked out is never re-cut. Before the first version
 * (and with none at all) periods are calendar months — how payroll always
 * worked, which is why a month approved before cycles existed reads back
 * under the same key.
 */

/** A Dhaka calendar day: "2026-11-16". */
export type DayKey = string;

export type Cycle =
  /** Whole calendar months, `every` at a time: 1 monthly, 2, 3 a quarter… */
  | { kind: "months"; every: number }
  /** Twice a month: the 1st up to `splitDay`, then `splitDay` to the end. */
  | { kind: "semi_monthly"; splitDay: number }
  | { kind: "weeks"; every: number }
  | { kind: "days"; every: number };

export type CycleKind = Cycle["kind"];

/** A cycle in force from `from` until the next version starts. */
export type CycleVersion = { from: DayKey; cycle: Cycle };

export type Period = {
  /** The first day. */
  start: DayKey;
  /** The day after the last one: the window is [start, end). */
  end: DayKey;
  /**
   * "2026-11" for exactly one calendar month — the key payroll months always
   * had — and "2026-11-01~2026-11-15" (last day inclusive) for anything else.
   */
  key: string;
};

export const CYCLE_LIMITS = {
  months: { min: 1, max: 12 },
  semi_monthly: { min: 2, max: 28 },
  weeks: { min: 1, max: 26 },
  days: { min: 1, max: 366 },
} as const;

/** How payroll always worked: one calendar month at a time. */
export const MONTHLY: Cycle = { kind: "months", every: 1 };

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RANGE_KEY_RE = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/;
const MS_PER_DAY = 86_400_000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));

// ───────────────────────────── days ─────────────────────────────

function parts(day: DayKey): { y: number; m: number; d: number } {
  const match = DAY_RE.exec(day);
  if (!match) throw new Error(`"${day}" is not a YYYY-MM-DD day`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Day arithmetic is done on the calendar date as if it were UTC midnight. */
function toUtc(day: DayKey): number {
  const { y, m, d } = parts(day);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A real calendar day, not just the right shape ("2026-02-30" is not). */
export function isDayKey(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(day: DayKey, n: number): DayKey {
  return fromUtc(toUtc(day) + n * MS_PER_DAY);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY);
}

export function firstOfMonth(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

/** The 1st of the month `n` months after the month `day` is in. */
export function addMonths(day: DayKey, n: number): DayKey {
  const { y, m } = parts(day);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function daysInMonth(day: DayKey): number {
  return daysBetween(firstOfMonth(day), addMonths(day, 1));
}

function dayOfMonth(day: DayKey): number {
  return parts(day).d;
}

function withDayOfMonth(day: DayKey, d: number): DayKey {
  return `${day.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

function monthIndex(day: DayKey): number {
  const { y, m } = parts(day);
  return y * 12 + (m - 1);
}

/** The Dhaka calendar day an instant falls on. */
export function dayOf(instant: Date): DayKey {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Midnight in Dhaka at the start of `day` — Bangladesh is UTC+6, no DST. */
export function dayStart(day: DayKey): Date {
  return new Date(`${day}T00:00:00+06:00`);
}

export function todayKey(now = new Date()): DayKey {
  return dayOf(now);
}

/** "1 Dec 2026" */
export function formatDay(day: DayKey): string {
  const { y, m, d } = parts(day);
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

// ───────────────────────────── cycles ─────────────────────────────

/** Why a cycle is out of bounds, or null when it is fine. */
export function cycleError(cycle: Cycle): string | null {
  const n = cycle.kind === "semi_monthly" ? cycle.splitDay : cycle.every;
  const { min, max } = CYCLE_LIMITS[cycle.kind];
  if (!Number.isInteger(n) || n < min || n > max) {
    return cycle.kind === "semi_monthly"
      ? `The second half must start between day ${min} and day ${max}.`
      : `Must be between ${min} and ${max}.`;
  }
  return null;
}

/**
 * Whether a cycle can begin on `day`: months start on the 1st, the halves of
 * a month on the 1st or the split day; weeks and days start on any day.
 */
export function canStartOn(cycle: Cycle, day: DayKey): boolean {
  if (!isDayKey(day)) return false;
  switch (cycle.kind) {
    case "months":
      return dayOfMonth(day) === 1;
    case "semi_monthly":
      return dayOfMonth(day) === 1 || dayOfMonth(day) === cycle.splitDay;
    default:
      return true;
  }
}

/** The first day on or after `day` that `cycle` may begin on. */
export function nextStartOn(cycle: Cycle, day: DayKey): DayKey {
  if (canStartOn(cycle, day)) return day;
  if (cycle.kind === "months") return addMonths(day, 1);
  if (cycle.kind === "semi_monthly") {
    return dayOfMonth(day) < cycle.splitDay
      ? withDayOfMonth(day, cycle.splitDay)
      : addMonths(day, 1);
  }
  return day;
}

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/** "Every 2 months", "Twice a month: 1st–15th and 16th–end". */
export function describeCycle(cycle: Cycle): string {
  switch (cycle.kind) {
    case "months":
      if (cycle.every === 1) return "Every month";
      if (cycle.every === 3) return "Every quarter";
      if (cycle.every === 6) return "Every 6 months";
      if (cycle.every === 12) return "Every year";
      return `Every ${cycle.every} months`;
    case "semi_monthly":
      return `Twice a month: 1st–${ordinal(cycle.splitDay - 1)} and ${ordinal(cycle.splitDay)}–end`;
    case "weeks":
      return cycle.every === 1 ? "Every week" : `Every ${cycle.every} weeks`;
    case "days":
      return cycle.every === 1 ? "Every day" : `Every ${cycle.every} days`;
  }
}

/** A stored cycle read back, or null when it is not one this code knows. */
export function toCycle(raw: unknown): Cycle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: unknown; every?: unknown; splitDay?: unknown };
  const n = (v: unknown) => (typeof v === "number" ? v : Number.NaN);
  let cycle: Cycle | null = null;
  if (r.kind === "months" || r.kind === "weeks" || r.kind === "days") {
    cycle = { kind: r.kind, every: n(r.every) };
  } else if (r.kind === "semi_monthly") {
    cycle = { kind: "semi_monthly", splitDay: n(r.splitDay) };
  }
  return cycle && !cycleError(cycle) ? cycle : null;
}

/**
 * Stored versions read back: anything malformed is dropped rather than
 * trusted, and what is left comes back oldest first.
 */
export function normalizeVersions(raw: unknown): CycleVersion[] {
  if (!Array.isArray(raw)) return [];
  const out: CycleVersion[] = [];
  for (const v of raw) {
    const from = (v as { from?: unknown } | null)?.from;
    const cycle = toCycle((v as { cycle?: unknown } | null)?.cycle);
    if (typeof from === "string" && isDayKey(from) && cycle) {
      out.push({ from, cycle });
    }
  }
  return sortVersions(out);
}

/** Versions oldest first, one per start day (a later one at the same day wins). */
export function sortVersions(versions: CycleVersion[]): CycleVersion[] {
  const byDay = new Map<DayKey, CycleVersion>();
  for (const v of versions) byDay.set(v.from, v);
  return [...byDay.values()].sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** The version in force on `day`, or null before the first one. */
export function versionOn(
  versions: CycleVersion[],
  day: DayKey,
): CycleVersion | null {
  let found: CycleVersion | null = null;
  for (const v of sortVersions(versions)) {
    if (v.from <= day) found = v;
    else break;
  }
  return found;
}

/**
 * Replace everything from `change.from` onwards with `change`. Versions that
 * began earlier are kept, so the periods they produced stay exactly as they
 * were.
 */
export function withVersion(
  versions: CycleVersion[],
  change: CycleVersion,
): CycleVersion[] {
  return sortVersions([
    ...versions.filter((v) => v.from < change.from),
    change,
  ]);
}

// ───────────────────────────── periods ─────────────────────────────

/** "2026-11" for one calendar month, "2026-11-01~2026-11-15" otherwise. */
export function periodKey(start: DayKey, end: DayKey): string {
  if (dayOfMonth(start) === 1 && end === addMonths(start, 1)) {
    return start.slice(0, 7);
  }
  return `${start}~${addDays(end, -1)}`;
}

/** The days a key covers, without needing the cycle that produced it. */
export function parsePeriodKey(
  key: string,
): { start: DayKey; end: DayKey } | null {
  if (MONTH_KEY_RE.test(key)) {
    const start = `${key}-01`;
    return { start, end: addMonths(start, 1) };
  }
  const match = RANGE_KEY_RE.exec(key);
  if (!match) return null;
  const [, a, b] = match as unknown as [string, string, string];
  if (!isDayKey(a) || !isDayKey(b) || b < a) return null;
  return { start: a, end: addDays(b, 1) };
}

export function isPeriodKey(key: string): boolean {
  return parsePeriodKey(key) !== null;
}

/** The period of `versions` that contains `day`. */
export function periodAt(versions: CycleVersion[], day: DayKey): Period {
  const sorted = sortVersions(versions);
  let current: CycleVersion | null = null;
  let next: DayKey | null = null;
  for (const v of sorted) {
    if (v.from <= day) current = v;
    else {
      next = v.from;
      break;
    }
  }

  let start: DayKey;
  let end: DayKey;
  const cycle = current?.cycle ?? MONTHLY;
  switch (cycle.kind) {
    case "months": {
      // Counted from the version's own first month; before any version,
      // from any 1st — every calendar month.
      const anchor = current?.from ?? firstOfMonth(day);
      const k = Math.floor(
        (monthIndex(day) - monthIndex(anchor)) / cycle.every,
      );
      start = addMonths(anchor, k * cycle.every);
      end = addMonths(start, cycle.every);
      break;
    }
    case "semi_monthly": {
      const first = firstOfMonth(day);
      if (dayOfMonth(day) < cycle.splitDay) {
        start = first;
        end = withDayOfMonth(day, cycle.splitDay);
      } else {
        start = withDayOfMonth(day, cycle.splitDay);
        end = addMonths(day, 1);
      }
      break;
    }
    default: {
      const anchor = current?.from ?? day;
      const length = cycle.kind === "weeks" ? cycle.every * 7 : cycle.every;
      const k = Math.floor(daysBetween(anchor, day) / length);
      start = addDays(anchor, k * length);
      end = addDays(start, length);
    }
  }
  // A period never starts before its own version nor runs into the next one:
  // the old cycle's last period is cut short where the new one begins.
  if (current && start < current.from) start = current.from;
  if (next && end > next) end = next;
  return { start, end, key: periodKey(start, end) };
}

/**
 * The period a key names under `versions`, or null when the key is not one
 * of their periods (a typed URL, or a key from before a cycle was cut).
 */
export function periodByKey(
  versions: CycleVersion[],
  key: string,
): Period | null {
  const parsed = parsePeriodKey(key);
  if (!parsed) return null;
  const period = periodAt(versions, parsed.start);
  return period.key === key ? period : null;
}

export function previousPeriod(
  versions: CycleVersion[],
  period: Period,
): Period {
  return periodAt(versions, addDays(period.start, -1));
}

export function nextPeriod(versions: CycleVersion[], period: Period): Period {
  return periodAt(versions, period.end);
}

/** `count` periods ending with the one that contains `day`, newest first. */
export function recentPeriods(
  versions: CycleVersion[],
  day: DayKey,
  count: number,
): Period[] {
  const out: Period[] = [];
  let p = periodAt(versions, day);
  for (let i = 0; i < count; i++) {
    out.push(p);
    p = previousPeriod(versions, p);
  }
  return out;
}

/** The newest period that has finished by `today`. */
export function lastEndedPeriod(
  versions: CycleVersion[],
  today: DayKey,
): Period {
  return previousPeriod(versions, periodAt(versions, today));
}

/** The period's window as instants, for queries. */
export function periodWindow(period: { start: DayKey; end: DayKey }): {
  start: Date;
  end: Date;
} {
  return { start: dayStart(period.start), end: dayStart(period.end) };
}

/** The window a key covers, as instants. */
export function windowOfKey(key: string): { start: Date; end: Date } | null {
  const parsed = parsePeriodKey(key);
  return parsed ? periodWindow(parsed) : null;
}

/**
 * "November 2026", "November – December 2026", "1–15 November 2026",
 * "28 October – 10 November 2026".
 */
export function periodLabel(start: DayKey, end: DayKey): string {
  const last = addDays(end, -1);
  const s = parts(start);
  const l = parts(last);
  const month = (m: number) => MONTH_NAMES[m - 1];
  if (dayOfMonth(start) === 1 && dayOfMonth(end) === 1) {
    if (end === addMonths(start, 1)) return `${month(s.m)} ${s.y}`;
    return s.y === l.y
      ? `${month(s.m)} – ${month(l.m)} ${l.y}`
      : `${month(s.m)} ${s.y} – ${month(l.m)} ${l.y}`;
  }
  if (start === last) return `${s.d} ${month(s.m)} ${s.y}`;
  if (s.y === l.y && s.m === l.m) return `${s.d}–${l.d} ${month(s.m)} ${s.y}`;
  if (s.y === l.y) return `${s.d} ${month(s.m)} – ${l.d} ${month(l.m)} ${l.y}`;
  return `${s.d} ${month(s.m)} ${s.y} – ${l.d} ${month(l.m)} ${l.y}`;
}

/** The label of a key, or the key itself if it is not one. */
export function labelOfKey(key: string): string {
  const parsed = parsePeriodKey(key);
  return parsed ? periodLabel(parsed.start, parsed.end) : key;
}

/** The calendar-month pieces of [start, end), for month-based rules. */
export function monthSegments(
  start: DayKey,
  end: DayKey,
): { month: string; start: DayKey; end: DayKey; days: number }[] {
  const out: { month: string; start: DayKey; end: DayKey; days: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    const monthEnd = addMonths(cursor, 1);
    const segEnd = monthEnd < end ? monthEnd : end;
    out.push({
      month: cursor.slice(0, 7),
      start: cursor,
      end: segEnd,
      days: daysBetween(cursor, segEnd),
    });
    cursor = segEnd;
  }
  return out;
}

// ───────────────────────────── salary ─────────────────────────────

/**
 * A fixed monthly salary earned over [start, end), counted on the days the
 * person was employed (`from` .. `to`, both inclusive; no `to` while they are
 * still here).
 *
 * Each calendar month pays its own salary by the day — November's 30 days at
 * a thirtieth each. The rounding is cumulative within a month, so the pieces
 * of one month always add up to exactly the monthly figure however it is cut:
 * two halves, four weeks or the whole. That is what lets a person be paid
 * twice a month while the profit split deducts the month in one go, without
 * the two ever disagreeing by a poisha.
 */
export function salaryBetween(
  monthlyMinor: number,
  start: DayKey,
  end: DayKey,
  employed: { from: DayKey; to?: DayKey | null },
): number {
  if (!monthlyMinor || monthlyMinor <= 0) return 0;
  const a = employed.from > start ? employed.from : start;
  let b = end;
  if (employed.to) {
    const after = addDays(employed.to, 1);
    if (after < b) b = after;
  }
  if (a >= b) return 0;
  let total = 0;
  for (const seg of monthSegments(a, b)) {
    const first = firstOfMonth(seg.start);
    const days = daysInMonth(first);
    const upTo = (n: number) => Math.round((monthlyMinor * n) / days);
    total +=
      upTo(daysBetween(first, seg.end)) - upTo(daysBetween(first, seg.start));
  }
  return total;
}
