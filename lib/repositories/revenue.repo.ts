import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { SalesOrder } from "@/lib/models/salesOrder";

/**
 * The company's revenue, from both places money comes in.
 *
 * There is exactly one definition, used by the dashboard, the reports and
 * payroll, so those three can never disagree:
 *
 *   - money is counted when it was PAID (`paidAt`), not when the order was
 *     raised, because that is when it arrived;
 *   - an order that was later cancelled or refunded does not count, even if it
 *     was once marked paid.
 *
 * Online orders and offline sales orders are summed together; the split is
 * returned as well, since "how much of this was the sales team" is the first
 * question anyone asks of the number.
 */

export type RevenueTotals = {
  totalMinor: number;
  onlineMinor: number;
  manualMinor: number;
  onlineCount: number;
  manualCount: number;
};

export type RevenueDay = {
  day: string;
  revenueMinor: number;
  onlineMinor: number;
  manualMinor: number;
  orders: number;
};

/** Paid, in the window, and not undone. */
const onlineMatch = (start: Date, end: Date) => ({
  "payment.status": "paid",
  "payment.paidAt": { $gte: start, $lt: end },
  status: { $nin: ["cancelled", "refunded"] },
});

const manualMatch = (start: Date, end: Date) => ({
  "payment.status": "paid",
  "payment.paidAt": { $gte: start, $lt: end },
  status: { $ne: "cancelled" },
  deletedAt: null,
});

export async function revenueBetween(
  start: Date,
  end: Date,
): Promise<RevenueTotals> {
  await connectToDatabase();
  const [online, manual] = await Promise.all([
    Order.aggregate<{ total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalMinor" },
          count: { $sum: 1 },
        },
      },
    ]),
    SalesOrder.aggregate<{ total: number; count: number }>([
      { $match: manualMatch(start, end) },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalMinor" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const onlineMinor = online[0]?.total ?? 0;
  const manualMinor = manual[0]?.total ?? 0;
  return {
    totalMinor: onlineMinor + manualMinor,
    onlineMinor,
    manualMinor,
    onlineCount: online[0]?.count ?? 0,
    manualCount: manual[0]?.count ?? 0,
  };
}

/**
 * Daily series across the window, zero-filled so a chart has a point per day.
 *
 * Days are bucketed in `timeZone` (Dhaka by default): a payment taken at 9pm
 * local belongs to that day's takings, not the next one's, which is what a UTC
 * bucket would record for anywhere east of Greenwich.
 */
export async function revenueByDay(
  start: Date,
  end: Date,
  timeZone = "Asia/Dhaka",
): Promise<RevenueDay[]> {
  await connectToDatabase();
  const group = (field: string) => [
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: `$${field}`,
            timezone: timeZone,
          },
        },
        total: { $sum: "$totalMinor" },
        count: { $sum: 1 },
      },
    },
  ];

  const [online, manual] = await Promise.all([
    Order.aggregate<{ _id: string; total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
    SalesOrder.aggregate<{ _id: string; total: number; count: number }>([
      { $match: manualMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
  ]);

  const onlineByDay = new Map(online.map((r) => [r._id, r]));
  const manualByDay = new Map(manual.map((r) => [r._id, r]));

  const days: RevenueDay[] = [];
  const DAY = 24 * 60 * 60 * 1000;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (let t = start.getTime(); t < end.getTime(); t += DAY) {
    const key = fmt.format(new Date(t));
    const o = onlineByDay.get(key);
    const m = manualByDay.get(key);
    days.push({
      day: key,
      revenueMinor: (o?.total ?? 0) + (m?.total ?? 0),
      onlineMinor: o?.total ?? 0,
      manualMinor: m?.total ?? 0,
      orders: (o?.count ?? 0) + (m?.count ?? 0),
    });
  }
  return days;
}
