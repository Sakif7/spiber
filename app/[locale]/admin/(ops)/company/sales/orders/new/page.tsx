import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import {
  getSalesLeadById,
  listSalesLeads,
} from "@/lib/repositories/sales.repo";
import { getMedtradeCommerceSettings } from "@/lib/services/shop-settings.service";
import { OrderEditor } from "@/components/admin/sales/order-editor";
import { LeadPicker } from "@/components/admin/sales/lead-picker";
import { activeEmployeeOptions } from "@/lib/repositories/expenses.repo";
import type { SalesOrderKind } from "@/lib/sales/equipment";

export const dynamic = "force-dynamic";

/** Raise a new order. A lead is required — it is who the order is addressed to. */
export default async function NewSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const leadId = typeof sp.lead === "string" ? sp.lead : undefined;
  // "?kind=equipment" pre-selects the type; otherwise the lead's own reasons
  // decide — a lead that came in for equipment (and not consumables) starts
  // as an equipment order. Either way it is a select on the form.
  const askedKind: SalesOrderKind | null =
    sp.kind === "equipment" || sp.kind === "consumables" ? sp.kind : null;

  const [lead, leads, commerce, employees] = await Promise.all([
    leadId ? getSalesLeadById(leadId) : Promise.resolve(null),
    listSalesLeads({ pageSize: 100, sort: "activity", dir: "desc" }).catch(
      () => null,
    ),
    getMedtradeCommerceSettings().catch(() => ({ vatRateBp: 0, aitRateBp: 0 })),
    activeEmployeeOptions().catch(() => []),
  ]);
  if (leadId && !lead) notFound();

  const reasons = lead?.reasons ?? [];
  const initialKind: SalesOrderKind =
    askedKind ??
    (reasons.includes("equipment") && !reasons.includes("consumable")
      ? "equipment"
      : "consumables");

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/sales/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to sales orders
      </Link>
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        New sales order
      </h1>

      {lead ? (
        <>
          <p className="text-muted-foreground">
            For{" "}
            <span className="text-foreground font-medium">
              {lead.organisation}
            </span>{" "}
            · <span className="font-mono text-xs">{lead.code}</span>
          </p>
          <OrderEditor
            leadId={String(lead._id)}
            initialKind={initialKind}
            initialLines={[]}
            initialDiscount={0}
            initialVatRateBp={commerce.vatRateBp}
            initialAitRateBp={commerce.aitRateBp}
            canEdit
          />
        </>
      ) : (
        <LeadPicker
          leads={(leads?.items ?? []).map((l) => ({
            id: String(l._id),
            organisation: l.organisation,
            code: l.code,
            contact: l.contactName,
          }))}
          employees={employees}
        />
      )}
    </div>
  );
}
