import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { travelRequestQuoteSchema } from "@/lib/schemas/travel-request";
import { setTravelQuote } from "@/lib/services/travel-request.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, travelRequestQuoteSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await setTravelQuote(id, parsed.data, admin.sub);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "travelRequest.quote",
    entityType: "TravelRequest",
    entityId: id,
    after: { amountMinor: parsed.data.amountMinor ?? null },
  });
  return ok({ id, status: result.request.status });
}
