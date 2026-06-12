import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { appointmentMeetingLinkSchema } from "@/lib/schemas/appointment";
import { setAppointmentMeetingLink } from "@/lib/services/appointment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, appointmentMeetingLinkSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await setAppointmentMeetingLink(id, parsed.data, admin.sub);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "appointment.meetingLink",
    entityType: "Appointment",
    entityId: id,
  });
  return ok({ id, status: result.appointment.status });
}
