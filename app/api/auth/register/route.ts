import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { registerInputSchema } from "@/lib/schemas/user";
import { register } from "@/lib/services/auth.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, registerInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await register(parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);
  return ok({ user: result.user });
}
