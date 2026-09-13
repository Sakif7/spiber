import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { QuotationActions } from "@/components/admin/quotation-actions";
import { getQuotationByIdLean } from "@/lib/repositories/quotations.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";
import { formatBDT } from "@/lib/money";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function AdminQuotationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const q = await getQuotationByIdLean(id).catch(() => null);
  if (!q) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && q.assignedTo && String(q.assignedTo) === user.sub,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-1">
        <EditorHeader
          backHref="/admin/quotations"
          backLabel="Quotations"
          title={q.quotationNumber}
        />
        <DetailMeta>
          {q.status} · {q.items.length} item{q.items.length === 1 ? "" : "s"} ·{" "}
          {new Date(q.createdAt).toLocaleString()}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <QuotationActions
            quotationId={String(q._id)}
            status={q.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Name">{q.contact.name}</DetailRow>
          <DetailRow label="Email">{q.contact.email}</DetailRow>
          {q.contact.phone && (
            <DetailRow label="Phone">{q.contact.phone}</DetailRow>
          )}
          {q.contact.organization && (
            <DetailRow label="Organization">{q.contact.organization}</DetailRow>
          )}
          <DetailRow label="Deliver to">
            {q.deliveryLocation.city
              ? `${q.deliveryLocation.city}, ${q.deliveryLocation.district}`
              : q.deliveryLocation.district}
          </DetailRow>
          {q.timeline && <DetailRow label="Timeline">{q.timeline}</DetailRow>}
        </DetailCard>

        <DetailCard title="Line items">
          {q.items.map((it, i) => (
            <div
              key={i}
              className={cn(
                "flex justify-between gap-3",
                i > 0 && "border-border border-t pt-2",
              )}
            >
              <span className="min-w-0">
                {localize(it.productSnapshot.name, asLocale(locale))}
                {it.productSnapshot.variantOptions &&
                it.productSnapshot.variantOptions.length > 0
                  ? ` (${it.productSnapshot.variantOptions.map((o) => o.value).join(" ·")})`
                  : ""}
                <span className="text-muted-foreground ml-2 font-mono text-xs">
                  {it.productSnapshot.sku}
                </span>
                {/* Negotiation reference captured when the RFQ was raised:
                    how far below list this item may be quoted. */}
                {it.productSnapshot.priceMinor != null && (
                  <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
                    List {formatBDT(it.productSnapshot.priceMinor)}
                    {it.productSnapshot.floorPriceMinor != null
                      ? ` · Floor ${formatBDT(it.productSnapshot.floorPriceMinor)}`
                      : ""}
                  </span>
                )}
              </span>
              <strong className="text-foreground shrink-0 tabular-nums">
                × {it.quantity}
              </strong>
            </div>
          ))}
        </DetailCard>

        {q.notes && (
          <DetailCard title="Customer note">
            <DetailProse>{q.notes}</DetailProse>
          </DetailCard>
        )}

        {q.quote?.amountMinor != null && (
          <DetailCard title="Current quote">
            <DetailRow label="Amount">
              <span className="tabular-nums">
                {formatBDT(q.quote.amountMinor)}
              </span>
            </DetailRow>
            {q.quote.validUntil && (
              <DetailRow label="Valid until">
                {new Date(q.quote.validUntil).toLocaleDateString()}
              </DetailRow>
            )}
            {q.quote.note && <DetailProse>{q.quote.note}</DetailProse>}
            {q.quote.fileKey && (
              <a
                href={`/api/media/quotation/${String(q._id)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-medium hover:underline"
              >
                View attached PDF
              </a>
            )}
          </DetailCard>
        )}

        {q.activity.length > 0 && (
          <DetailCard title="Activity">
            {q.activity.map((n, i) => (
              <div key={i} className="grid gap-0.5">
                <span className="text-foreground">{n.body}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(n.at).toLocaleString()}
                </span>
              </div>
            ))}
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
