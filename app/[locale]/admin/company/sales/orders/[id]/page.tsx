import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getSalesOrderById } from "@/lib/repositories/sales.repo";
import { EDITABLE_STATUSES } from "@/lib/schemas/sales-order";
import { formatBDT } from "@/lib/money";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { OrderEditor } from "@/components/admin/sales/order-editor";
import { StageRail } from "@/components/admin/sales/stage-rail";
import { blockers } from "@/lib/sales/journey";
import {
  OrderActions,
  type VersionRow,
} from "@/components/admin/sales/order-actions";

export const dynamic = "force-dynamic";

/** One sales order: its lines, its documents and everything it can do next. */
export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const order = await getSalesOrderById(id);
  if (!order) notFound();

  const canEdit = EDITABLE_STATUSES.includes(order.status);
  // What stops the next step, in the words of whoever has to fix it. Shared by
  // the rail (which lists them) and the actions panel (which disables on them).
  const orderBlockers = blockers(
    order.status,
    order.items.map((i) => ({
      description: i.description,
      unitPriceMinor: i.unitPriceMinor,
      qty: i.qty,
    })),
    canEdit,
  );
  const toVersion = (v: (typeof order.proposals)[number]): VersionRow => ({
    version: v.version,
    generatedAt: new Date(v.generatedAt).toISOString(),
    invoiceNumber: v.snapshot?.invoiceNumber ?? null,
    emailedTo: v.emailedTo ?? [],
    emailedAt: v.emailedAt ? new Date(v.emailedAt).toISOString() : null,
    superseded: Boolean(v.supersededAt),
  });

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/sales/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to sales orders
      </Link>

      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {order.leadSnapshot.organisation}
        </h1>
        <p className="text-muted-foreground mt-1">
          <span className="font-mono text-xs">{order.number}</span>
          {order.invoiceNumber ? (
            <>
              {" · invoice"}
              <span className="font-mono text-xs">{order.invoiceNumber}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Where this order is and what happens next, above everything else. */}
      <StageRail
        status={order.status}
        paymentStatus={order.payment.status}
        blockers={orderBlockers}
      />

      <DetailLayout
        aside={
          <>
            <OrderActions
              id={id}
              status={order.status}
              paymentStatus={order.payment.status}
              leadEmail={order.leadSnapshot.email ?? null}
              proposals={order.proposals.map(toVersion)}
              invoices={order.invoices.map(toVersion)}
              defaultPaymentDays={order.terms.paymentDays}
              blockers={orderBlockers}
            />

            <DetailCard title="Client">
              <DetailRow label="Contact">
                {order.leadSnapshot.contactName}
              </DetailRow>
              <DetailRow label="Phone">{order.leadSnapshot.phone}</DetailRow>
              <DetailRow label="Email">
                {order.leadSnapshot.email ?? "—"}
              </DetailRow>
              <DetailRow label="Address">
                {order.leadSnapshot.address}
              </DetailRow>
              <DetailRow label="Lead">
                <Link
                  href={`/admin/company/sales/leads/${String(order.leadId)}`}
                  className="text-primary hover:underline"
                >
                  Open lead
                </Link>
              </DetailRow>
            </DetailCard>

            <DetailCard title="Money">
              <DetailRow label="Subtotal">
                {formatBDT(order.subtotalMinor, "en")}
              </DetailRow>
              {order.discountMinor > 0 && (
                <DetailRow label="Discount">
                  −{formatBDT(order.discountMinor, "en")}
                </DetailRow>
              )}
              {order.vatMinor > 0 && (
                <DetailRow label={`VAT (${order.vatRateBp / 100}%)`}>
                  {formatBDT(order.vatMinor, "en")}
                </DetailRow>
              )}
              <DetailRow label="Total" mono>
                {formatBDT(order.totalMinor, "en")}
              </DetailRow>
              {order.payment.status === "paid" && order.payment.paidAt && (
                <DetailRow label="Paid">
                  {new Date(order.payment.paidAt).toLocaleDateString()}
                  {order.payment.method ? ` · ${order.payment.method}` : ""}
                  {order.payment.reference
                    ? ` · ${order.payment.reference}`
                    : ""}
                </DetailRow>
              )}
            </DetailCard>

            {order.activity.length > 0 && (
              <DetailCard title="History">
                <div className="grid gap-2">
                  {[...order.activity].reverse().map((a, i) => (
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
        {!canEdit && (
          <p className="text-muted-foreground">
            This order can no longer be edited.
          </p>
        )}
        <OrderEditor
          orderId={id}
          initialLines={order.items.map((i) => ({
            id: i.id,
            kind: i.kind,
            productId: i.productId ? String(i.productId) : null,
            variantId: i.variantId ?? null,
            sku: i.sku ?? null,
            description: i.description,
            brandOrigin: i.brandOrigin ?? "",
            specification: i.specification ?? "",
            unit: i.unit ?? "",
            unitPrice: String(i.unitPriceMinor / 100),
            qty: String(i.qty),
          }))}
          initialDiscount={order.discountMinor}
          initialDelivery={order.deliveryMinor ?? 0}
          initialReferenceNo={order.referenceNo ?? ""}
          initialVatRateBp={order.vatRateBp}
          canEdit={canEdit}
        />
      </DetailLayout>
    </div>
  );
}
