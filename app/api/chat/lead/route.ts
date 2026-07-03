import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { chatLeadSchema } from "@/lib/schemas/chat";
import { captureChatLead } from "@/lib/services/chat.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`chat-lead:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, chatLeadSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  // Honeypot: a filled hidden field means a bot — fake success, persist nothing.
  if (parsed.data.website) {
    return ok({
      leadNumber: "SPM-LEAD-OK",
      conversationId: parsed.data.conversationId ?? "",
    });
  }

  const result = await captureChatLead(parsed.data, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return ok(result);
}
