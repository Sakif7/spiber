import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  salesOrderUpdateSchema,
  salesOrderTransitionSchema,
  salesOrderPaymentSchema,
  proposalGenerateSchema,
  invoiceGenerateSchema,
  sendDocumentSchema,
} from "@/lib/schemas/sales-order";
import {
  amendOrder,
  transitionOrder,
  recordPayment,
} from "@/lib/services/sales-order.service";
import {
  generateProposal,
  generateInvoice,
  sendDocument,
} from "@/lib/services/sales-document.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales, salesStatus } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Amend the order's lines, discount or terms. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardSales("sales-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, salesOrderUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await amendOrder(id, parsed.data, g.actor);
  if (!res.ok) {
    return fail(
      { code: res.code, details: { lineId: res.lineId, item: res.detail } },
      salesStatus(res.code),
    );
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "salesOrder.amend",
      entityType: "SalesOrder",
      entityId: id,
      after: { items: res.data.items.length, total: res.data.totalMinor },
    },
    req,
  );
  return ok({ id, totalMinor: res.data.totalMinor });
}

/**
 * Everything else an order can do, keyed by `action`.
 *
 * One endpoint rather than five, because these are all "advance this order" and
 * they share the same guard, audit shape and error mapping.
 */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("sales-write", 60);
  if (!g.ok) return g.res;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    [k: string]: unknown;
  } | null;
  if (!body?.action) return fail({ code: "invalid_input" }, 400);

  switch (body.action) {
    case "transition": {
      const parsed = salesOrderTransitionSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await transitionOrder(id, parsed.data.to, g.actor, {
        note: parsed.data.note,
      });
      if (!res.ok) {
        return fail(
          { code: res.code, details: { lineId: res.lineId, item: res.detail } },
          salesStatus(res.code),
        );
      }
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: `salesOrder.${parsed.data.to}`,
          entityType: "SalesOrder",
          entityId: id,
          after: { status: parsed.data.to },
        },
        req,
      );
      return ok({ id, status: parsed.data.to });
    }

    case "payment": {
      const parsed = salesOrderPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await recordPayment(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: `salesOrder.payment.${parsed.data.status}`,
          entityType: "SalesOrder",
          entityId: id,
          after: {
            payment: res.data.payment.status,
            total: res.data.totalMinor,
          },
        },
        req,
      );
      return ok({ id, payment: res.data.payment.status });
    }

    case "proposal": {
      const parsed = proposalGenerateSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await generateProposal(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.proposal.generate",
          entityType: "SalesOrder",
          entityId: id,
          after: { version: res.data.version },
        },
        req,
      );
      return ok(res.data);
    }

    case "invoice": {
      const parsed = invoiceGenerateSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await generateInvoice(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.invoice.generate",
          entityType: "SalesOrder",
          entityId: id,
          after: {
            version: res.data.version,
            invoiceNumber: res.data.invoiceNumber,
          },
        },
        req,
      );
      return ok(res.data);
    }

    case "send": {
      const kind = body.kind === "invoice" ? "invoice" : "proposal";
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1) {
        return fail({ code: "invalid_input" }, 400);
      }
      const parsed = sendDocumentSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await sendDocument(id, kind, version, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.document.send",
          entityType: "SalesOrder",
          entityId: id,
          after: { kind, version, to: res.data.to },
        },
        req,
      );
      return ok(res.data);
    }

    default:
      return fail({ code: "invalid_input" }, 400);
  }
}
