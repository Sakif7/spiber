import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getSalesOrderById } from "@/lib/repositories/sales.repo";
import {
  EDITABLE_STATUSES,
  namedVatRateBp,
  percentOf,
} from "@/lib/schemas/sales-order";
import { formatBDT } from "@/lib/money";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { OrderEditor } from "@/components/admin/sales/order-editor";
import { OrderCostsPanel } from "@/components/admin/sales/order-costs-panel";
import { StageRail } from "@/components/admin/sales/stage-rail";
import { blockers } from "@/lib/sales/journey";
import { documentMatchesOrder } from "@/lib/sales/document-state";
import {
  equipmentSummary,
  machineLinesOf,
  orderKindOf,
  SALES_ORDER_KIND_LABEL,
} from "@/lib/sales/equipment";
import { StatusBadge } from "@/components/admin/ui/status-badge";
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
  const kind = orderKindOf(order);
  // The kind decides the paper, so it is fixed once any paper exists.
  const kindLocked = order.status !== "draft" || order.proposals.length > 0;
  /** The terms the latest equipment proposal went out with, if any. */
  const lastEquipmentTerms =
    [...order.proposals].reverse().find((p) => p.snapshot?.equipmentTerms)
      ?.snapshot?.equipmentTerms ?? null;
  /** One line carrying its own VAT takes the whole order off the order rate. */
  const perLineVat = order.items.some(
    (i) => i.vatRateBp != null || i.vatAmountMinor != null,
  );
  /** The rate the order's VAT is named by — a typed figure's, worked out. */
  const vatNamedBp = namedVatRateBp({
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    vatRateBp: order.vatRateBp,
    vatAmountMinor: order.vatAmountMinor ?? null,
  });
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
    kind,
  );
  /**
   * The order as it stands, for comparison against what each document says.
   *
   * A stored document deliberately does not follow the order — a client holds
   * a printed copy — so after an amendment the two disagree, and nothing on
   * screen said which was which. Now they do.
   */
  const liveSnapshot = {
    items: order.items.map((i) => ({
      description: i.description,
      unitPriceMinor: i.unitPriceMinor,
      qty: i.qty,
    })),
    totalMinor: order.totalMinor,
  };
  const toVersion = (v: (typeof order.proposals)[number]): VersionRow => ({
    version: v.version,
    generatedAt: new Date(v.generatedAt).toISOString(),
    invoiceNumber: v.snapshot?.invoiceNumber ?? null,
    emailedTo: v.emailedTo ?? [],
    emailedAt: v.emailedAt ? new Date(v.emailedAt).toISOString() : null,
    templateVersion: v.templateRef?.version ?? 0,
    superseded: Boolean(v.supersededAt),
    stale: !documentMatchesOrder(
      {
        items: (v.snapshot?.items ?? []).map((i) => ({
          description: i.description,
          unitPriceMinor: i.unitPriceMinor,
          qty: i.qty,
        })),
        totalMinor: v.snapshot?.totalMinor ?? 0,
        quantityMode: v.snapshot?.quantityMode ?? null,
      },
      liveSnapshot,
    ),
  });

  const proposalRows = order.proposals.map(toVersion);
  const invoiceRows = order.invoices.map(toVersion);
  // Orders raised before challans existed read back undefined, not [].
  const challanRows = (order.challans ?? []).map(toVersion);
  /** The one a client would be sent if someone clicked Email right now. */
  const current = (rows: VersionRow[]) =>
    [...rows].reverse().find((r) => !r.superseded);
  const staleDocs = [
    current(invoiceRows)?.stale ? "invoice" : null,
    current(proposalRows)?.stale ? "proposal" : null,
  ].filter(Boolean) as string[];

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
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{order.number}</span>
          {order.invoiceNumber ? (
            <>
              {" · invoice"}
              <span className="font-mono text-xs">{order.invoiceNumber}</span>
            </>
          ) : null}
          <StatusBadge tone={kind === "equipment" ? "info" : "neutral"}>
            {SALES_ORDER_KIND_LABEL[kind]}
          </StatusBadge>
        </p>
      </div>

      {/* Where this order is and what happens next, above everything else. */}
      <StageRail
        status={order.status}
        paymentStatus={order.payment.status}
        blockers={orderBlockers}
      />

      {!canEdit && (
        <p className="text-muted-foreground -mt-2">
          This order can no longer be edited.
        </p>
      )}

      {staleDocs.length > 0 && (
        <p className="-mt-2 rounded-md border border-[color-mix(in_srgb,var(--tone-warning)_var(--tone-edge),transparent)] bg-[color-mix(in_srgb,var(--tone-warning)_var(--tone-fill),transparent)] px-3 py-2 text-[var(--tone-warning-fg)]">
          The order has changed since the {staleDocs.join(" and the ")} was
          generated, so {staleDocs.length > 1 ? "they show" : "it shows"} the
          earlier figures. Generate a new one before sending anything to the
          client.
        </p>
      )}

      <DetailLayout
        /* A narrow, fixed sidebar rather than a share of the width: the items
           table has nine columns of its own and every point the aside takes is
           one the numbers lose. */
        className="lg:grid-cols-[minmax(0,1fr)_340px]"
        aside={
          <>
            <OrderActions
              id={id}
              status={order.status}
              paymentStatus={order.payment.status}
              leadEmail={order.leadSnapshot.email ?? null}
              proposals={proposalRows}
              invoices={invoiceRows}
              challans={challanRows}
              defaultPaymentDays={order.terms.paymentDays}
              withholding={Boolean(order.withholding)}
              hasMultiples={order.items.some((i) => i.qty > 1)}
              blockers={orderBlockers}
              kind={kind}
              equipmentSubject={`Price Offer for ${equipmentSummary(
                machineLinesOf(order.items),
              )}`}
              equipmentTerms={lastEquipmentTerms}
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

            <OrderCostsPanel
              orderId={id}
              initialCosts={(order.costs ?? []).map((c) => ({
                id: c.id,
                label: c.label,
                amountMinor: c.amountMinor,
              }))}
              lines={order.items.map((i) => ({
                id: i.id,
                description: i.description,
                unitCostMinor: i.unitCostMinor ?? null,
              }))}
              grossProfitMinor={
                order.subtotalMinor -
                order.discountMinor -
                order.items.reduce(
                  (t, i) => t + (i.unitCostMinor ?? 0) * i.qty,
                  0,
                )
              }
            />

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
                <DetailRow
                  label={
                    perLineVat
                      ? "VAT (per line)"
                      : vatNamedBp == null
                        ? "VAT"
                        : `VAT (${percentOf(vatNamedBp)}%)`
                  }
                >
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
        <OrderEditor
          orderId={id}
          initialKind={kind}
          kindLocked={kindLocked}
          initialLines={order.items.map((i) => ({
            id: i.id,
            kind: i.kind,
            productId: i.productId ? String(i.productId) : null,
            variantId: i.variantId ?? null,
            sku: i.sku ?? null,
            description: i.description,
            role: i.role ?? undefined,
            brandOrigin: i.brandOrigin ?? "",
            specification: i.specification ?? "",
            model: i.model ?? "",
            manufacturer: i.manufacturer ?? "",
            origin: i.origin ?? "",
            serialNo: i.serialNo ?? "",
            unit: i.unit ?? "",
            unitPrice: String(i.unitPriceMinor / 100),
            unitCost:
              i.unitCostMinor != null ? String(i.unitCostMinor / 100) : "",
            // Shown back the way it was entered: a rate stays a rate, a figure
            // stays a figure, so re-saving cannot quietly convert one to the
            // other and move the total.
            vatValue:
              i.vatAmountMinor != null
                ? String(i.vatAmountMinor / 100)
                : i.vatRateBp != null
                  ? String(i.vatRateBp / 100)
                  : "",
            vatMode:
              i.vatAmountMinor != null
                ? ("amount" as const)
                : ("percent" as const),
            qty: String(i.qty),
          }))}
          initialDiscount={order.discountMinor}
          initialDelivery={order.deliveryMinor ?? 0}
          initialReferenceNo={order.referenceNo ?? ""}
          initialVatRateBp={order.vatRateBp}
          initialVatAmountMinor={order.vatAmountMinor ?? null}
          initialAitRateBp={order.aitRateBp ?? 0}
          canEdit={canEdit}
        />
      </DetailLayout>
    </div>
  );
}
