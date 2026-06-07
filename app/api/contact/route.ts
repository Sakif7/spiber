import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { contactMessageCreateSchema } from "@/lib/schemas/contact";
import { createContactMessage } from "@/lib/services/contact.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Public Contact-form submission. No auth — rate-limited + honeypot-guarded. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`contact:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const parsed = await parseJson(req, contactMessageCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  // Honeypot: a real user can't see/fill `website`. If it's set, treat as spam
  // — drop silently with a fake-success so bots learn nothing.
  if (parsed.data.website) {
    return ok({ contactNumber: "SPM-MSG-OK", status: "new" });
  }

  const msg = await createContactMessage(parsed.data, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return ok({ contactNumber: msg.contactNumber, status: msg.status });
}
