import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { passwordResetConfirmSchema } from "@/lib/schemas/user";
import { resetPassword } from "@/lib/services/auth.service";
import { markInviteAccepted } from "@/lib/services/hr/employee-access.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`pwconfirm:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, passwordResetConfirmSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await resetPassword(parsed.data);
  if (!result.ok) return fail({ code: "invalid_token" }, 400);
  // Best-effort: the employee page shows when the invite was used.
  if (result.invite) await markInviteAccepted(result.sub).catch(() => {});
  return ok({ invite: result.invite });
}
