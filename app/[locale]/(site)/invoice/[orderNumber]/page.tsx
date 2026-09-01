import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PrintButton } from "@/components/academy/print-button";
import { InvoiceSheet } from "@/components/commerce/invoice-sheet";
import { toInvoiceOrder } from "@/lib/services/invoice.service";
import {
  getOrderByNumber,
  findOrderForGuest,
} from "@/lib/repositories/orders.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { asLocale } from "@/lib/i18n/intl-locale";
import type { IOrder } from "@/lib/models/order";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Customer-facing printable invoice.
 *
 * Access is either ownership (signed in as the buyer) or the same
 * number + email pair the guest order lookup already uses — the order number is
 * unguessable and the email must match. Anything else 404s, so this can't be
 * used to probe whether an order exists.
 */
export default async function CustomerInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : undefined;
  const t = await getTranslations({ locale, namespace: "invoice" });

  const session = await getSessionUser();

  // Normalize to a plain object at each fetch site: getOrderByNumber returns a
  // hydrated doc, findOrderForGuest returns a lean one.
  let plain: IOrder | null = null;
  if (session) {
    const owned = await getOrderByNumber(orderNumber).catch(() => null);
    if (owned && String(owned.userId ?? "") === session.sub) {
      plain = owned.toObject();
    }
  }
  if (!plain && email) {
    const guest = await findOrderForGuest(orderNumber, email).catch(() => null);
    if (guest) plain = guest as unknown as IOrder;
  }
  if (!plain) notFound();

  const order = toInvoiceOrder(plain);

  return (
    <section style={{ paddingBlock: "clamp(32px, 4vw, 64px)" }}>
      <Container>
        <div
          style={{ display: "grid", gap: "var(--s-5)", justifyItems: "start" }}
        >
          <div className="no-print">
            <PrintButton label={t("print")} />
          </div>
          <InvoiceSheet order={order} locale={asLocale(locale)} />
        </div>
      </Container>
    </section>
  );
}
