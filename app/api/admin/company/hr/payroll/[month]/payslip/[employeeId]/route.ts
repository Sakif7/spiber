import React from "react";
import { getRun } from "@/lib/services/hr/payroll.service";
import { monthLabel } from "@/lib/hr/months";
import { renderFitted } from "@/lib/pdf/render";
import { PayslipDocument } from "@/lib/pdf/payslip";
import { getSetting } from "@/lib/repositories/settings.repo";
import { getCurrentTemplate } from "@/lib/services/pdf-template.service";
import { CONTACT } from "@/lib/contact";
import { auditDocumentView } from "@/lib/audit/document-view";
import { logger } from "@/lib/log";
import { guardSales } from "../../../../../sales/_guard";

export const dynamic = "force-dynamic";

/** One director's payslip for one month, as a PDF. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ month: string; employeeId: string }> },
) {
  const g = await guardSales("hr-doc", 60);
  if (!g.ok) return g.res;
  const { month, employeeId } = await params;

  const run = await getRun(month, g.actor);
  if (!run.ok) return new Response("Not found", { status: 404 });
  const line = run.data.lines.find((l) => String(l.employeeId) === employeeId);
  if (!line) return new Response("Not found", { status: 404 });

  try {
    await auditDocumentView({
      actorId: g.actor.sub,
      action: "payroll.payslip.view",
      entityType: "PayrollRun",
      entityId: `${month}:${employeeId}`,
      after: { month, employee: line.name },
      req,
    });
  } catch (e) {
    logger.warn("payslip audit failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  const signatory = await getSetting<{
    name?: string;
    title?: string;
    phone?: string;
    email?: string;
  }>("sales.signatory").catch(() => null);

  // Payslips are not filed or versioned, so a re-opened one is drawn with
  // whatever template is current — unlike the sales documents.
  const tpl = await getCurrentTemplate("payslip");
  const pdf = await renderFitted((fit) =>
    React.createElement(PayslipDocument, {
      fit,
      template: tpl.template,
      assets: tpl.assets,
      data: {
        month,
        monthLabel: monthLabel(month),
        employee: {
          name: line.name,
          code: line.code,
          designation: line.designation,
        },
        revenueMinor: run.data.revenue.totalMinor,
        onlineMinor: run.data.revenue.onlineMinor,
        manualMinor: run.data.revenue.manualMinor,
        // A month from before shareholdings has no pool; the template then
        // prints the revenue basis that month was actually computed on.
        pool: run.data.pool
          ? {
              grossProfitMinor: run.data.pool.grossProfitMinor,
              orderCostsMinor: run.data.pool.orderCostsMinor,
              expensesMinor: run.data.pool.expensesMinor,
              aitMinor: run.data.pool.aitMinor,
              netCashMinor: run.data.pool.netCashMinor,
              salariesMinor: run.data.pool.salariesMinor,
              distributableMinor: run.data.pool.distributableMinor,
              totalShares: line.poolShares ?? run.data.pool.totalShares,
            }
          : null,
        shares: line.shares ?? null,
        rateBp: line.rateBp,
        amountMinor: line.amountMinor,
        paidAt: line.paidAt ?? null,
        reference: line.reference ?? null,
        approvedAt: run.data.approvedAt ?? null,
        signatory: {
          name: signatory?.name ?? "Dr. Md Jahidul Islam",
          title: signatory?.title ?? "Managing Director",
          phone: signatory?.phone ?? CONTACT.phone,
          email: signatory?.email ?? "md@spibermed.com",
        },
      },
    }),
  );

  const filename = `Payslip ${line.name} ${month}.pdf`.replace(
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
