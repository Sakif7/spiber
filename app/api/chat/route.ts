import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { handleChatTurn } from "@/lib/services/chat.service";
import { getSessionUser } from "@/lib/auth/current-user";
import type { ChatResponseDTO } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`chat:${ip}`, 30, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, chatRequestSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const user = await getSessionUser().catch(() => null);
  const result = await handleChatTurn(
    {
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      locale: parsed.data.locale,
      path: parsed.data.path,
      state: parsed.data.state,
      loggedIn: Boolean(user),
      userId: user?.sub ?? null,
    },
    {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
      path: parsed.data.path,
    },
  );

  return ok(result satisfies ChatResponseDTO);
}
