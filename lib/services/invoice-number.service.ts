import { connectToDatabase } from "@/lib/db/connect";
import { Counter } from "@/lib/models/counter";
import { getSetting } from "@/lib/repositories/settings.repo";

/**
 * Invoice numbering, matching the format already in use on paper:
 *
 *   SPIBER/EWMCH/14-8/26-714
 *          │     │    │  └─ running sequence, company-wide, never reset
 *          │     │    └──── two-digit year
 *          │     └───────── invoice day-month
 *          └─────────────── the client's short code, stored on the lead
 *
 * The sequence is one shared counter rather than one per client or per year, so
 * the same number can never be issued twice however invoices are interleaved.
 */

const COUNTER_ID = "salesInvoice";
/** Where the sequence starts, if the company wants to continue a paper series. */
const SEED_SETTING = "sales.invoiceSeqSeed";

/**
 * Reserve the next number. Atomic: two admins invoicing at the same instant get
 * different sequences, because `$inc` happens inside the database.
 */
export async function nextInvoiceSeq(): Promise<number> {
  await connectToDatabase();
  const seed = await getSetting<number>(SEED_SETTING).catch(() => null);
  const doc = await Counter.findOneAndUpdate(
    { _id: COUNTER_ID },
    {
      $inc: { seq: 1 },
      $setOnInsert: { _id: COUNTER_ID },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<{ seq: number }>();

  const seq = doc?.seq ?? 1;
  // A configured seed only applies while the counter is still at the start: it
  // says "continue the paper series from here", not "renumber what we issued".
  if (typeof seed === "number" && seed > 0 && seq <= seed) {
    const bumped = await Counter.findOneAndUpdate(
      { _id: COUNTER_ID, seq: { $lte: seed } },
      { $set: { seq: seed + 1 } },
      { returnDocument: "after" },
    ).lean<{ seq: number }>();
    return bumped?.seq ?? seq;
  }
  return seq;
}

/** The number the NEXT invoice would get, for display in settings. */
export async function peekInvoiceSeq(): Promise<number> {
  await connectToDatabase();
  const [doc, seed] = await Promise.all([
    Counter.findById(COUNTER_ID).lean<{ seq: number }>(),
    getSetting<number>(SEED_SETTING).catch(() => null),
  ]);
  const current = doc?.seq ?? 0;
  if (typeof seed === "number" && seed > 0 && current <= seed) return seed + 1;
  return current + 1;
}

/** Day and month as they read in Bangladesh, where the invoice is issued. */
function dhakaParts(date: Date): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/**
 * Build the printed number. Day and month are unpadded and the year is the last
 * two digits, exactly as on the existing invoices (`SPIBER/EWMCH/14-8/26-714`).
 */
export function formatInvoiceNumber(input: {
  code: string;
  date: Date;
  seq: number;
}): string {
  const { day, month, year } = dhakaParts(input.date);
  const yy = String(year % 100).padStart(2, "0");
  const code = input.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `SPIBER/${code}/${day}-${month}/${yy}-${input.seq}`;
}
