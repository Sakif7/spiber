import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { SalesOrder } from "@/lib/models/salesOrder";
import { SoftwarePurchase } from "@/lib/models/softwarePurchase";
import { Enrollment } from "@/lib/models/enrollment";
import { MedicalCase } from "@/lib/models/medicalCase";
import { TravelRequest } from "@/lib/models/travelRequest";

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

/**
 * Our own software and courses, paid in the window and not undone. External
 * apps (ZenHcare) are excluded: that money is the vendor's, not ours.
 */
const softwareMatch = (start: Date, end: Date) => ({
  ...onlineMatch(start, end),
  "productSnapshot.deliveryType": { $ne: "external" },
});

/**
 * Tourism quotes paid online — what was collected (`payment.amountMinor`, not
 * the quote). A lost case or a cancelled request is out: that money goes back.
 */
const tourismMatch = (start: Date, end: Date, undone: string) => ({
  "payment.status": "paid",
  "payment.paidAt": { $gte: start, $lt: end },
  status: { $ne: undone },
  deletedAt: null,
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
  const sum = [
    {
      $group: {
        _id: null,
        total: { $sum: "$totalMinor" },
        count: { $sum: 1 },
      },
    },
  ];
  const collected = [
    {
      $group: {
        _id: null,
        total: { $sum: "$payment.amountMinor" },
        count: { $sum: 1 },
      },
    },
  ];
  const [shop, software, courses, cases, travel, manual] = await Promise.all([
    Order.aggregate<{ total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      ...sum,
    ]),
    SoftwarePurchase.aggregate<{ total: number; count: number }>([
      { $match: softwareMatch(start, end) },
      ...sum,
    ]),
    Enrollment.aggregate<{ total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      ...sum,
    ]),
    MedicalCase.aggregate<{ total: number; count: number }>([
      { $match: tourismMatch(start, end, "lost") },
      ...collected,
    ]),
    TravelRequest.aggregate<{ total: number; count: number }>([
      { $match: tourismMatch(start, end, "cancelled") },
      ...collected,
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
  const online = [shop, software, courses, cases, travel].map((r) => r[0]);
  const onlineMinor = online.reduce((t, r) => t + (r?.total ?? 0), 0);
  const manualMinor = manual[0]?.total ?? 0;
  return {
    totalMinor: onlineMinor + manualMinor,
    onlineMinor,
    manualMinor,
    onlineCount: online.reduce((t, r) => t + (r?.count ?? 0), 0),
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
  const group = (field: string, amount = "$totalMinor") => [
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: `$${field}`,
            timezone: timeZone,
          },
        },
        total: { $sum: amount },
        count: { $sum: 1 },
      },
    },
  ];

  const [shop, software, courses, cases, travel, manual] = await Promise.all([
    Order.aggregate<{ _id: string; total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
    SoftwarePurchase.aggregate<{ _id: string; total: number; count: number }>([
      { $match: softwareMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
    Enrollment.aggregate<{ _id: string; total: number; count: number }>([
      { $match: onlineMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
    MedicalCase.aggregate<{ _id: string; total: number; count: number }>([
      { $match: tourismMatch(start, end, "lost") },
      ...group("payment.paidAt", "$payment.amountMinor"),
    ]),
    TravelRequest.aggregate<{ _id: string; total: number; count: number }>([
      { $match: tourismMatch(start, end, "cancelled") },
      ...group("payment.paidAt", "$payment.amountMinor"),
    ]),
    SalesOrder.aggregate<{ _id: string; total: number; count: number }>([
      { $match: manualMatch(start, end) },
      ...group("payment.paidAt"),
    ]),
  ]);

  // Storefronts, software, courses and tourism are all "online": one row per day.
  const onlineByDay = new Map<string, { total: number; count: number }>();
  for (const r of [...shop, ...software, ...courses, ...cases, ...travel]) {
    const day = onlineByDay.get(r._id) ?? { total: 0, count: 0 };
    day.total += r.total;
    day.count += r.count;
    onlineByDay.set(r._id, day);
  }
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
