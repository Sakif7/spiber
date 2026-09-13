import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { myLead, myOrders } from "@/lib/services/me.service";
import { districtLabel } from "@/lib/bd/districts";
import { LEAD_REASON_LABEL } from "@/lib/schemas/sales-lead";
import { formatBDT } from "@/lib/money";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../../_shared";

export const dynamic = "force-dynamic";

/** One of my leads, read-only: the office keeps editing rights. */
export default async function MyLeadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, `/admin/me/leads/${id}`);
  const lead = await myLead(session, id);
  if (!lead) notFound();
  const orders = await myOrders(session, { pageSize: 50 });
  const mine = orders.items.filter((o) => String(o.leadId) === id);

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/me/leads"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        My leads
      </Link>
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {lead.organisation}
        </h1>
        <DetailMeta className="mt-1">
          {lead.code} · {lead.leadNumber}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <DetailCard title="Status">
            <DetailRow label="Stage">
              <StatusBadge tone={statusTone(lead.status)}>
                {cap(lead.status)}
              </StatusBadge>
            </DetailRow>
            <DetailRow label="Last activity">
              {day(lead.lastActivityAt)}
            </DetailRow>
            <DetailRow label="Added">{day(lead.createdAt)}</DetailRow>
            {(lead.reasons ?? []).length > 0 && (
              <DetailRow label="Reason">
                <span className="flex flex-wrap justify-end gap-1">
                  {(lead.reasons ?? []).map((r) => (
                    <StatusBadge key={r} tone="neutral">
                      {LEAD_REASON_LABEL[r]}
                    </StatusBadge>
                  ))}
                </span>
              </DetailRow>
            )}
          </DetailCard>
        }
      >
        <DetailCard title="Contact">
          <DetailRow label="Contact">{lead.contactName}</DetailRow>
          <DetailRow label="Phone" mono>
            {lead.phone}
          </DetailRow>
          <DetailRow label="Email" mono>
            {lead.email ?? "—"}
          </DetailRow>
          <DetailRow label="Address">{lead.address}</DetailRow>
          <DetailRow label="Region">
            {districtLabel(lead.area) ?? "—"}
          </DetailRow>
          {lead.remark && <DetailRow label="Remark">{lead.remark}</DetailRow>}
        </DetailCard>

        <DetailCard
          title="Sales orders"
          description={
            mine.length === 0
              ? "No orders for this lead yet."
              : `${mine.length} order${mine.length === 1 ? "" : "s"} you can see.`
          }
        >
          {mine.length > 0 && (
            <ul className="divide-border grid divide-y">
              {mine.map((o) => (
                <li
                  key={String(o._id)}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/admin/me/orders/${String(o._id)}`}
                    className="text-primary font-mono text-xs hover:underline"
                  >
                    {o.number}
                  </Link>
                  <StatusBadge tone={statusTone(o.status)}>
                    {cap(o.status)}
                  </StatusBadge>
                  <span className="font-mono text-xs">
                    {formatBDT(o.totalMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>

        <DetailCard
          title="Activity"
          description="The office's notes and stage changes on this lead."
        >
          {lead.activity.length === 0 ? (
            <p className="text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {[...lead.activity]
                .sort(
                  (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
                )
                .slice(0, 30)
                .map((a, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3"
                  >
                    <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {day(a.at)}
                    </span>
                    <span className="min-w-0 break-words">
                      {a.body}
                      {a.from && a.to && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {cap(a.from)} → {cap(a.to)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
