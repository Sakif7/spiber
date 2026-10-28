import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  salesOrderUpdateSchema,
  salesOrderTransitionSchema,
  salesOrderPaymentSchema,
  proposalGenerateSchema,
  invoiceGenerateSchema,
  challanGenerateSchema,
  sendDocumentSchema,
  withholdingSchema,
  orderCostsSchema,
  amendCostsSchema,
} from "@/lib/schemas/sales-order";
import {
  amendOrder,
  transitionOrder,
  recordPayment,
  recordWithholding,
  setOrderCosts,
  amendLineCosts,
  repeatOrder,
} from "@/lib/services/sales-order.service";
import {
  generateProposal,
  generateInvoice,
  generateChallan,
  sendDocument,
} from "@/lib/services/sales-document.service";
import {
  cancelSalesPaymentLink,
  ensureSalesPaymentLink,
  payLinkUrl,
} from "@/lib/services/payment-link.service";
import { paymentLinkSchema } from "@/lib/schemas/payment";
import { getSalesOrderById } from "@/lib/repositories/sales.repo";
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

    case "costs": {
      const parsed = orderCostsSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await setOrderCosts(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.costs.set",
          entityType: "SalesOrder",
          entityId: id,
          after: {
            costs: parsed.data.costs.map((c) => ({
              label: c.label,
              amountMinor: c.amountMinor,
            })),
            reason: parsed.data.reason ?? null,
          },
        },
        req,
      );
      return ok({ id });
    }

    case "amend-costs": {
      const parsed = amendCostsSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      // What the line cost us is ours alone; the invoice the client holds is
      // untouched by this, which is why it is allowed after the order locks.
      const res = await amendLineCosts(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.costs.amend",
          entityType: "SalesOrder",
          entityId: id,
          after: { lines: parsed.data.lines, reason: parsed.data.reason },
        },
        req,
      );
      return ok(res.data);
    }

    case "withholding": {
      const parsed = withholdingSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await recordWithholding(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.withholding.record",
          entityType: "SalesOrder",
          entityId: id,
          after: {
            aitRateBp: res.data.withholding?.aitRateBp,
            aitMinor: res.data.withholding?.aitMinor,
            certificateReceived: res.data.withholding?.certificateReceived,
          },
        },
        req,
      );
      return ok({ id });
    }

    case "invoice": {
      const parsed = invoiceGenerateSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      // "Create invoice" arrives here straight from a returned proposal — or
      // from a draft, when a repeat order is going out without being quoted
      // again. Move the order first: that is what issues the number and
      // reserves the stock. If reserving fails the order stays put and no
      // document exists.
      const current = await getSalesOrderById(id);
      if (
        current &&
        (current.status === "proposal_returned" || current.status === "draft")
      ) {
        const moved = await transitionOrder(id, "invoiced", g.actor);
        if (!moved.ok)
          return fail({ code: moved.code }, salesStatus(moved.code));
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

    case "repeat": {
      const res = await repeatOrder(id, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      const newId = String(res.data.order._id);
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.repeat",
          entityType: "SalesOrder",
          entityId: newId,
          after: {
            copiedFrom: id,
            items: res.data.order.items.length,
            priceChanges: res.data.priceChanges.length,
          },
        },
        req,
      );
      return ok({
        id: newId,
        number: res.data.order.number,
        priceChanges: res.data.priceChanges,
      });
    }

    case "challan": {
      const parsed = challanGenerateSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await generateChallan(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "salesOrder.challan.generate",
          entityType: "SalesOrder",
          entityId: id,
          after: {
            version: res.data.version,
            challanNumber: res.data.challanNumber,
          },
        },
        req,
      );
      return ok(res.data);
    }

    case "send": {
      const kind =
        body.kind === "invoice"
          ? "invoice"
          : body.kind === "challan"
            ? "challan"
            : "proposal";
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

    case "payment-link": {
      const parsed = paymentLinkSchema.safeParse(body);
      if (!parsed.success) {
        return fail(
          { code: "invalid_input", details: parsed.error.issues },
          400,
        );
      }
      const res = await ensureSalesPaymentLink(id, parsed.data, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      if (res.created || res.sentTo) {
        await writeAudit(
          {
            actorId: g.actor.sub,
            action: res.sentTo
              ? "salesOrder.paymentLink.email"
              : "salesOrder.paymentLink.create",
            entityType: "SalesOrder",
            entityId: id,
            after: {
              link: String(res.link._id),
              amountMinor: res.link.amountMinor,
              created: res.created,
              to: res.sentTo,
            },
          },
          req,
        );
      }
      return ok({
        url: payLinkUrl(res.link.token),
        amountMinor: res.link.amountMinor,
        created: res.created,
        sentTo: res.sentTo,
      });
    }

    case "payment-link-cancel": {
      const res = await cancelSalesPaymentLink(id, g.actor);
      if (!res.ok) return fail({ code: res.code }, salesStatus(res.code));
      if (res.cancelled > 0) {
        await writeAudit(
          {
            actorId: g.actor.sub,
            action: "salesOrder.paymentLink.cancel",
            entityType: "SalesOrder",
            entityId: id,
            after: { cancelled: res.cancelled },
          },
          req,
        );
      }
      return ok({ cancelled: res.cancelled });
    }

    default:
      return fail({ code: "invalid_input" }, 400);
  }
}
