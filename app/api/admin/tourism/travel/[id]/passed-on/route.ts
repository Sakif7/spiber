import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { tourismPassedOnSchema } from "@/lib/schemas/payment";
import { setPassedOn } from "@/lib/services/tourism-payment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** What the request passes on to the airline / provider: its cost. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, tourismPassedOnSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const saved = await setPassedOn(
    "travel_request",
    id,
    parsed.data.passedOnMinor,
    admin.sub,
  );
  if (!saved) return fail({ code: "not_found" }, 404);
  await writeAudit(
    {
      actorId: admin.sub,
      action: "travelRequest.passedOn",
      entityType: "TravelRequest",
      entityId: id,
      after: { passedOnMinor: parsed.data.passedOnMinor },
    },
    req,
  );
  return ok({ id });
}
