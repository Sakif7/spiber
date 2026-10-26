import React from "react";
import { getPayout } from "@/lib/services/hr/payout.service";
import { renderFitted } from "@/lib/pdf/render";
import { PayslipDocument } from "@/lib/pdf/payslip";
import { getSetting } from "@/lib/repositories/settings.repo";
import { getCurrentTemplate } from "@/lib/services/pdf-template.service";
import { CONTACT } from "@/lib/contact";
import { auditDocumentView } from "@/lib/audit/document-view";
import { dayOf, periodLabel } from "@/lib/hr/cycles";
import { logger } from "@/lib/log";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * The salary payslip for one payout: the fixed salary it paid, for the days it
 * paid. A shareholder's payslip is per profit period instead — it shows how
 * the pool was worked out — so a payout with no salary in it has none here.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("hr-doc", 60);
  if (!g.ok) return g.res;
  const { id } = await params;

  const payout = await getPayout(id);
  if (!payout || payout.status !== "paid") {
    return new Response("Not found", { status: 404 });
  }
  const salary = payout.items.filter(
    (i) => i.kind === "salary" || i.kind === "run_salary",
  );
  if (salary.length === 0) return new Response("Not found", { status: 404 });

  try {
    await auditDocumentView({
      actorId: g.actor.sub,
      action: "payroll.payslip.view",
      entityType: "PayrollPayout",
      entityId: id,
      after: { ref: payout.ref, employee: payout.name },
      req,
    });
  } catch (e) {
    logger.warn("payslip audit failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  // The days the salary covered: from the earliest item to the latest.
  const days = salary.flatMap((i) =>
    i.from && i.to
      ? [{ from: dayOf(new Date(i.from)), to: dayOf(new Date(i.to)) }]
      : [],
  );
  const label = days.length
    ? periodLabel(
        days.map((d) => d.from).sort()[0]!,
        days
          .map((d) => d.to)
          .sort()
          .reverse()[0]!,
      )
    : salary.map((i) => i.label).join(", ");

  const signatory = await getSetting<{
    name?: string;
    title?: string;
    phone?: string;
    email?: string;
  }>("sales.signatory").catch(() => null);

  const tpl = await getCurrentTemplate("payslip");
  const pdf = await renderFitted((fit) =>
    React.createElement(PayslipDocument, {
      fit,
      template: tpl.template,
      assets: tpl.assets,
      data: {
        month: payout.periodKey,
        monthLabel: label,
        employee: {
          name: payout.name,
          code: payout.code,
          designation: payout.designation,
        },
        revenueMinor: 0,
        onlineMinor: 0,
        manualMinor: 0,
        pool: null,
        shares: null,
        rateBp: null,
        amountMinor: salary.reduce((n, i) => n + i.amountMinor, 0),
        paidAt: payout.paidAt ?? null,
        reference: payout.reference || payout.ref,
        approvedAt: payout.createdAt,
        signatory: {
          name: signatory?.name ?? "Dr. Md Jahidul Islam",
          title: signatory?.title ?? "Managing Director",
          phone: signatory?.phone ?? CONTACT.phone,
          email: signatory?.email ?? "md@spibermed.com",
        },
      },
    }),
  );

  const filename = `Payslip ${payout.name} ${payout.ref}.pdf`.replace(
    /[^\w.\- ]+/g,
    "_",
  );
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
