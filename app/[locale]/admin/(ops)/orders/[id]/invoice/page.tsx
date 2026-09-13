import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/academy/print-button";
import { InvoiceSheet } from "@/components/commerce/invoice-sheet";
import { toInvoiceOrder } from "@/lib/services/invoice.service";
import { getOrderById } from "@/lib/repositories/orders.repo";
import { asLocale } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

/** Admin-side printable invoice (the admin layout already guards this route). */
export default async function AdminOrderInvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "invoice" });

  const doc = await getOrderById(id).catch(() => null);
  if (!doc) notFound();
  const order = toInvoiceOrder(doc.toObject());

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/admin/orders/${id}`}
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          ← Back to order {order.orderNumber}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      <InvoiceSheet order={order} locale={asLocale(locale)} />
    </div>
  );
}
