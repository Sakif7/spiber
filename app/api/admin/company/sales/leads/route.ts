import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { salesLeadCreateSchema } from "@/lib/schemas/sales-lead";
import { createLead } from "@/lib/services/sales-lead.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales, salesStatus } from "../_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardSales("sales-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, salesLeadCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createLead(parsed.data, g.actor);
  if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "salesLead.create",
      entityType: "SalesLead",
      entityId: String(res.data._id),
      after: { organisation: res.data.organisation, code: res.data.code },
    },
    req,
  );
  return ok({ id: String(res.data._id), leadNumber: res.data.leadNumber });
}
