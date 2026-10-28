import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { findOrderForGuest } from "@/lib/repositories/orders.repo";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import {
  customerPaymentState,
  orderDuePayable,
} from "@/lib/services/payment.service";
import { isGatewayProvider } from "@/lib/schemas/order";

// Guest order lookup requires BOTH the (unguessable) order number and the
// matching email — validated + rate-limited to blunt order/email enumeration.
const lookupSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(200),
});

export async function GET(req: Request) {
  if (!rateLimit(`order-lookup:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const url = new URL(req.url);
  const parsed = lookupSchema.safeParse({
    orderNumber: url.searchParams.get("orderNumber"),
    email: url.searchParams.get("email"),
  });
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);

  const order = await findOrderForGuest(
    parsed.data.orderNumber,
    parsed.data.email,
  );
  if (!order) return fail({ code: "not_found" }, 404);
  // Serialize a SAFE subset — never the raw document (which carries
  // idempotencyKey, payment.raw, and admin-only internal timeline notes).
  return ok({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      subtotalMinor: order.subtotalMinor,
      shippingMinor: order.shippingMinor,
      discountMinor: order.discountMinor,
      taxMinor: order.taxMinor ?? 0,
      taxRateBp: order.taxRateBp ?? null,
      roundingMinor: order.roundingMinor ?? 0,
      totalMinor: order.totalMinor,
      // How it's paid + when it falls due (credit). No provider/txn internals.
      paymentMethod: order.payment?.method ?? "offline",
      paymentStatus: order.payment?.status ?? "unpaid",
      dueAt: order.payment?.dueAt ?? null,
      // Online orders still waiting for their money: whether "Pay again" is
      // open. Credit / COD orders still owed: whether "Pay now" is.
      paymentState: {
        ...customerPaymentState(order),
        canPayNow: await orderDuePayable(order),
      },
      // A COD order paid online: nothing is collected at the door.
      paidOnline:
        order.payment?.status === "paid" &&
        (order.payment?.method ?? "offline") === "cod" &&
        isGatewayProvider(order.payment?.provider),
      trackingNumber: order.trackingNumber ?? null,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        productSnapshot: {
          name: i.productSnapshot.name,
          sku: i.productSnapshot.sku,
          variantOptions: i.productSnapshot.variantOptions ?? [],
        },
        qty: i.qty,
        lineTotalMinor: i.lineTotalMinor,
      })),
      timeline: (order.timeline ?? []).map((e) => ({
        status: e.status,
        at: e.at,
        note: e.note ?? null,
      })),
    },
  });
}
