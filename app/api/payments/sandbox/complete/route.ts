import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { signSandboxPayload } from "@/lib/payments/dev.provider";
import { makeId } from "@/lib/ids";

export const dynamic = "force-dynamic";

const completeSchema = z.object({
  orderNumber: z.string().trim().min(3).max(64),
  amountMinor: z.number().int().min(0),
  outcome: z.enum(["paid", "failed"]),
  /** Lets a test deliver the same event twice to prove the replay guard. */
  eventId: z.string().trim().max(80).optional(),
});

/**
 * Stands in for the acquirer's back end: signs a callback and delivers it to
 * our own webhook, exactly as a real gateway would.
 *
 * Going over HTTP rather than calling the service directly is the point. It
 * exercises signature verification, the route's status codes and the replay
 * guard, so the code paths proven here are the same ones a real gateway will
 * take.
 *
 * Sandbox only, and it refuses to exist in production.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return fail({ code: "not_found" }, 404);
  }
  const parsed = await parseJson(req, completeSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const payload = {
    eventId: parsed.data.eventId || makeId("EVT"),
    orderNumber: parsed.data.orderNumber,
    outcome: parsed.data.outcome,
    amountMinor: parsed.data.amountMinor,
    txnId: makeId("TXN"),
  };
  const body = JSON.stringify(payload);

  // The running server's own origin, so this works on any port without config.
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/payments/webhook/dev`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sandbox-signature": signSandboxPayload(body),
    },
    body,
  });

  const text = await res.text();
  return ok({ status: res.status, eventId: payload.eventId, body: text });
}
