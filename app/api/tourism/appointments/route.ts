import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/current-user";
import { appointmentCreateSchema } from "@/lib/schemas/appointment";
import { createAppointment } from "@/lib/services/appointment.service";

export const dynamic = "force-dynamic";

/** Public appointment / teleconsultation booking REQUEST. Rate-limited + honeypot. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`appointment:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, appointmentCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (parsed.data.website) {
    return ok({ appointmentNumber: "SPM-APT-OK", status: "pending" });
  }
  const user = await getSessionUser();
  const created = await createAppointment(parsed.data, {
    userId: user?.sub,
    locale: parsed.data.locale,
  });
  return ok({
    appointmentNumber: created.appointmentNumber,
    status: created.status,
  });
}
