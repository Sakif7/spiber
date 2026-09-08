import { ok, fail } from "@/lib/http/respond";
import {
  salesLeadUpdateSchema,
  salesLeadTransitionSchema,
} from "@/lib/schemas/sales-lead";
import { updateLead, transitionLead } from "@/lib/services/sales-lead.service";
import { softDeleteSalesLead } from "@/lib/repositories/sales.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales, salesStatus } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const g = await guardSales("sales-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  // A status change is its own action, with its own activity entry.
  if (body && typeof body === "object" && "to" in body) {
    const parsed = salesLeadTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
    }
    const res = await transitionLead(
      id,
      parsed.data.to,
      g.actor,
      parsed.data.note,
    );
    if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: `salesLead.${parsed.data.to}`,
        entityType: "SalesLead",
        entityId: id,
        after: { status: parsed.data.to },
      },
      req,
    );
    return ok({ id, status: parsed.data.to });
  }

  const parsed = salesLeadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }
  const res = await updateLead(id, parsed.data);
  if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "salesLead.update",
      entityType: "SalesLead",
      entityId: id,
      after: parsed.data,
    },
    req,
  );
  return ok({ id });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("sales-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const deleted = await softDeleteSalesLead(id).catch(() => false);
  if (!deleted) return fail({ code: "not_found" }, 404);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "salesLead.delete",
      entityType: "SalesLead",
      entityId: id,
    },
    req,
  );
  return ok({ id });
}
