import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { myOrder } from "@/lib/services/me.service";
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

/**
 * One of my orders, read-only. Prices and totals are shown; costs, margins
 * and the document files stay with the office.
 */
export default async function MyOrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, `/admin/me/orders/${id}`);
  const order = await myOrder(session, id);
  if (!order) notFound();
  const money = (n: number) => formatBDT(n, "en");

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/me/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        My sales orders
      </Link>
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {order.leadSnapshot.organisation}
        </h1>
        <DetailMeta className="mt-1">
          {order.number}
          {order.invoiceNumber && ` · invoice ${order.invoiceNumber}`}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <>
            <DetailCard title="Status">
              <DetailRow label="Order">
                <StatusBadge tone={statusTone(order.status)}>
                  {cap(order.status)}
                </StatusBadge>
              </DetailRow>
              <DetailRow label="Payment">
                <StatusBadge
                  tone={order.payment.status === "paid" ? "success" : "warning"}
                >
                  {cap(order.payment.status)}
                </StatusBadge>
              </DetailRow>
              {order.payment.paidAt && (
                <DetailRow label="Paid on">
                  {day(order.payment.paidAt)}
                </DetailRow>
              )}
              {order.invoicedAt && (
                <DetailRow label="Invoiced">{day(order.invoicedAt)}</DetailRow>
              )}
              {order.deliveredAt && (
                <DetailRow label="Delivered">
                  {day(order.deliveredAt)}
                </DetailRow>
              )}
              <DetailRow label="Recorded">{day(order.createdAt)}</DetailRow>
            </DetailCard>
            <DetailCard title="Documents">
              <DetailRow label="Proposals">{order.proposals.length}</DetailRow>
              <DetailRow label="Invoices">{order.invoices.length}</DetailRow>
              <DetailRow label="Challans">
                {(order.challans ?? []).length}
              </DetailRow>
              <p className="text-muted-foreground text-xs">
                Ask the office for a copy of a document.
              </p>
            </DetailCard>
          </>
        }
      >
        <DetailCard title="Client">
          <DetailRow label="Organisation">
            {order.leadSnapshot.organisation}
          </DetailRow>
          <DetailRow label="Contact">
            {order.leadSnapshot.contactName}
          </DetailRow>
          <DetailRow label="Phone" mono>
            {order.leadSnapshot.phone}
          </DetailRow>
          <DetailRow label="Address">{order.leadSnapshot.address}</DetailRow>
        </DetailCard>

        <DetailCard title="Items" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Unit price
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Line</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2">
                      <span className="block">{it.description}</span>
                      {it.sku && (
                        <span className="text-muted-foreground block font-mono text-xs">
                          {it.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {it.qty}
                      {it.unit ? ` ${it.unit}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {money(it.unitPriceMinor)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {money(it.lineTotalMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border grid gap-1 border-t px-4 pt-3 text-sm">
            <DetailRow label="Subtotal" mono>
              {money(order.subtotalMinor)}
            </DetailRow>
            {order.discountMinor > 0 && (
              <DetailRow label="Discount" mono>
                − {money(order.discountMinor)}
              </DetailRow>
            )}
            <DetailRow label="VAT" mono>
              {money(order.vatMinor)}
            </DetailRow>
            {order.deliveryMinor > 0 && (
              <DetailRow label="Delivery" mono>
                {money(order.deliveryMinor)}
              </DetailRow>
            )}
            <DetailRow label="Total" mono>
              <strong>{money(order.totalMinor)}</strong>
            </DetailRow>
          </div>
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
