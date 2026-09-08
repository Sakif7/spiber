import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { salesOrderCreateSchema } from "@/lib/schemas/sales-order";
import { createOrder } from "@/lib/services/sales-order.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales, salesStatus } from "../_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardSales("sales-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, salesOrderCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createOrder(parsed.data, g.actor);
  if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "salesOrder.create",
      entityType: "SalesOrder",
      entityId: String(res.data._id),
      after: {
        number: res.data.number,
        organisation: res.data.leadSnapshot.organisation,
        items: res.data.items.length,
      },
    },
    req,
  );
  return ok({ id: String(res.data._id), number: res.data.number });
}
