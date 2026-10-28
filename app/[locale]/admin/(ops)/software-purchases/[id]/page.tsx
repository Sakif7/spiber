import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PurchaseActions } from "@/components/admin/purchase-actions";
import { getPurchaseById } from "@/lib/repositories/purchases.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import {
  DetailCard,
  DetailLayout,
  DetailRow,
} from "@/components/admin/ui/detail";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  PaymentAttemptsCard,
  toAttemptRows,
} from "@/components/admin/payments/payment-attempts-card";
import { attemptsForSubject } from "@/lib/repositories/payment-attempts.repo";

export const dynamic = "force-dynamic";

export default async function AdminPurchaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const doc = await getPurchaseById(id).catch(() => null);
  if (!doc) notFound();
  const p = doc.toObject();
  const attempts = await attemptsForSubject("software", id).catch(() => []);
  const canRecheck = attempts.some(
    (a) => a.status === "open" || a.status === "abandoned",
  );

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/software-purchases"
        backLabel="Software purchases"
        title={p.purchaseNumber}
      />

      <DetailLayout
        aside={
          <PurchaseActions
            purchaseId={String(p._id)}
            status={p.status}
            fulfillmentStatus={p.fulfillment.status}
            paidOnline={attempts.some((a) => a.status === "paid")}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Product">
            {localize(p.productSnapshot.name, "en")}
          </DetailRow>
          <DetailRow label="Email">{p.email}</DetailRow>
          <DetailRow label="Status">
            <StatusBadge>{p.status}</StatusBadge>
          </DetailRow>
          <DetailRow label="Payment">
            <StatusBadge>{p.payment.status}</StatusBadge>
          </DetailRow>
          <DetailRow label="Delivery">
            {p.productSnapshot.deliveryType}
          </DetailRow>
          <DetailRow label="Total">
            <span className="tabular-nums">
              {formatBDT(p.totalMinor, "en")}
            </span>
          </DetailRow>
        </DetailCard>

        {attempts.length > 0 ? (
          <PaymentAttemptsCard
            rows={toAttemptRows(attempts)}
            recheckUrl={
              canRecheck ? `/api/admin/payments/software/${id}/recheck` : null
            }
          />
        ) : null}

        <DetailCard title="Fulfillment">
          <DetailRow label="Status">
            <StatusBadge>{p.fulfillment.status}</StatusBadge>
          </DetailRow>
          {p.fulfillment.licenseId && (
            <DetailRow label="License" mono>
              {String(p.fulfillment.licenseId)}
            </DetailRow>
          )}
          {p.fulfillment.provisioningTaskId && (
            <DetailRow label="Provisioning task" mono>
              {String(p.fulfillment.provisioningTaskId)}
            </DetailRow>
          )}
          {p.fulfillment.commissionId && (
            <DetailRow label="Commission" mono>
              {String(p.fulfillment.commissionId)}
            </DetailRow>
          )}
        </DetailCard>

        <DetailCard title="Timeline">
          {p.timeline.map((tl, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="text-foreground">{tl.status}</span>
              <span className="text-muted-foreground min-w-0 text-right">
                {new Date(tl.at).toLocaleString()}
                {tl.note ? ` — ${tl.note}` : ""}
              </span>
            </div>
          ))}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
