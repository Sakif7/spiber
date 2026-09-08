import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Plus } from "lucide-react";
import {
  getSalesLeadById,
  listSalesOrders,
} from "@/lib/repositories/sales.repo";
import { formatBDT } from "@/lib/money";
import { LeadForm } from "@/components/admin/sales/lead-form";
import { LeadStatusPanel } from "@/components/admin/sales/lead-status-panel";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const label = (s: string) =>
  s.replace(/_/g, "").replace(/^./, (c) => c.toUpperCase());

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const lead = await getSalesLeadById(id);
  if (!lead) notFound();

  const orders = await listSalesOrders({ leadId: id, pageSize: 10 }).catch(
    () => null,
  );

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/sales/leads"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to leads
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {lead.organisation}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lead.leadNumber} · code{" "}
            <span className="font-mono">{lead.code}</span>
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/admin/company/sales/orders/new?lead=${id}`}>
            <Plus className="size-4" />
            New sales order
          </Link>
        </Button>
      </div>

      <DetailLayout
        aside={
          <>
            <LeadStatusPanel id={id} status={lead.status} />
            <DetailCard title="Orders">
              {orders && orders.items.length > 0 ? (
                <div className="grid gap-2">
                  {orders.items.map((o) => (
                    <Link
                      key={String(o._id)}
                      href={`/admin/company/sales/orders/${String(o._id)}`}
                      className="hover:bg-accent flex items-center justify-between gap-2 rounded px-2 py-1.5"
                    >
                      <span className="font-mono text-xs">{o.number}</span>
                      <StatusBadge tone={statusTone(o.status)}>
                        {label(o.status)}
                      </StatusBadge>
                      <span className="font-medium">
                        {formatBDT(o.totalMinor, "en")}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No orders for this lead yet.
                </p>
              )}
            </DetailCard>
            {lead.activity.length > 0 && (
              <DetailCard title="Activity">
                <div className="grid gap-2">
                  {[...lead.activity]
                    .reverse()
                    .slice(0, 12)
                    .map((a, i) => (
                      <div key={i} className="">
                        <p>{a.body}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(a.at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              </DetailCard>
            )}
          </>
        }
      >
        <DetailCard title="Details">
          <DetailRow label="Contact">{lead.contactName}</DetailRow>
          <DetailRow label="Phone">{lead.phone}</DetailRow>
          <DetailRow label="Email">{lead.email ?? "—"}</DetailRow>
          <DetailRow label="Address">{lead.address}</DetailRow>
        </DetailCard>

        <LeadForm
          lead={{
            id,
            organisation: lead.organisation,
            code: lead.code,
            contactName: lead.contactName,
            phone: lead.phone,
            email: lead.email ?? "",
            address: lead.address,
            addresseeTitle: lead.addresseeTitle ?? "",
            addresseeDept: lead.addresseeDept ?? "",
            remark: lead.remark ?? "",
          }}
        />
      </DetailLayout>
    </div>
  );
}
