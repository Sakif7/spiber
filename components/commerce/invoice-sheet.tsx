import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { formatBDT } from "@/lib/money";
import { localize, type Localized } from "@/lib/schemas/localized";
import { siteConfig } from "@/lib/site-config";
import { LEGAL, OFFICES, CONTACT } from "@/lib/contact";
import { RETURN_WINDOW_DAYS } from "@/lib/schemas/order";
import { bcp47 } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

/** Serialized, safe subset of an order — never the raw document. */
export type InvoiceOrder = {
  orderNumber: string;
  status: string;
  email: string;
  createdAt: string;
  storefront?: "instruments" | "marketplace";
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  taxRateBp?: number | null;
  aitRateBp?: number | null;
  /** Poisha dropped so the total is whole taka (0 to −99). */
  roundingMinor?: number;
  totalMinor: number;
  payment: {
    method: string;
    status: string;
    termsDays?: number | null;
    dueAt?: string | null;
    paidAt?: string | null;
  };
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    district: string;
    postalCode?: string;
    phone: string;
  };
  items: {
    name: Localized;
    sku: string;
    unitPriceMinor: number;
    qty: number;
    lineTotalMinor: number;
    variantOptions?: { name: string; value: string }[];
  }[];
};

/**
 * AIT (Advance Income Tax) shown on the invoice. It is withheld at source by
 * the buyer, so it NEVER affects what we charge — it is derived here purely for
 * display, from the rate snapshotted on the order.
 */
export function deriveAitMinor(order: {
  subtotalMinor: number;
  discountMinor: number;
  aitRateBp?: number | null;
}): number {
  if (!order.aitRateBp || order.aitRateBp <= 0) return 0;
  const base = order.subtotalMinor - order.discountMinor;
  return Math.round((base * order.aitRateBp) / 10000);
}

/**
 * Printable invoice, rendered on demand from the stored order (no PDF is
 * stored — the reader prints to PDF from the browser). A scoped @media print
 * rule isolates the sheet from the surrounding page chrome, the same approach
 * as the tourism treatment quotation.
 *
 * Storefront-agnostic: it serves Spiber Kart orders too, but the delivery-time
 * promise only prints for Medtrade.
 */
export async function InvoiceSheet({
  order,
  locale,
}: {
  order: InvoiceOrder;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "invoice" });
  const office = OFFICES[0];
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(bcp47(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const method = order.payment.method || "offline";
  const aitMinor = deriveAitMinor(order);
  const voided = order.status === "cancelled" || order.status === "refunded";

  const terms =
    method === "cod"
      ? t("termsCod")
      : method === "credit"
        ? t("termsCredit", {
            days: order.payment.termsDays ?? 30,
            due: order.payment.dueAt ? fmtDate(order.payment.dueAt) : "—",
          })
        : method === "online"
          ? t("termsOnline")
          : t("termsOffline");

  return (
    <>
      {/* Print isolation — hide everything but the sheet. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden !important; }
            #invoice-sheet, #invoice-sheet * { visibility: visible !important; }
            #invoice-sheet { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
            .no-print { display: none !important; }
          }`,
        }}
      />

      <article
        id="invoice-sheet"
        style={{
          background: "#fff",
          color: "var(--color-text)",
          padding: "clamp(24px, 4vw, 48px)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          display: "grid",
          gap: "var(--s-5)",
          maxWidth: 860,
        }}
      >
        {/* Header: who is billing, and which document this is. */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--s-5)",
            flexWrap: "wrap",
            borderBottom: "2px solid var(--color-secondary)",
            paddingBottom: "var(--s-4)",
          }}
        >
          <div style={{ display: "grid", gap: 4, maxWidth: "42ch" }}>
            <Image
              src="/spibermed-wordmark.png"
              alt={siteConfig.brand}
              width={150}
              height={34}
              style={{ height: 34, width: "auto", objectFit: "contain" }}
            />
            <strong
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-text-strong)",
              }}
            >
              {LEGAL.name}
            </strong>
            <span style={muted}>
              {localize(office.address, locale)
                .split("\n")
                .map((line, i) => (
                  <span key={i} style={{ display: "block" }}>
                    {line}
                  </span>
                ))}
            </span>
            <span style={muted}>
              {CONTACT.phone} · {CONTACT.generalEmail}
            </span>
            <span style={muted}>
              BIN: {LEGAL.bin || "—"} · TIN: {LEGAL.tin || "—"}
            </span>
          </div>

          <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h3)",
                color: "var(--color-brand-deep)",
              }}
            >
              {t("title")}
            </span>
            <span style={muted}>{t("invoiceNo")}</span>
            <strong style={{ fontFamily: "var(--font-mono)" }}>
              {order.orderNumber}
            </strong>
            <span style={muted}>
              {t("orderDate")}: {fmtDate(order.createdAt)}
            </span>
            <span style={muted}>
              {t("issued")}: {fmtDate(new Date())}
            </span>
          </div>
        </header>

        {voided ? (
          <p
            style={{
              margin: 0,
              padding: "10px 14px",
              borderRadius: "var(--r-sm)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-strong)",
              fontWeight: 600,
            }}
          >
            {order.status === "cancelled"
              ? t("cancelledNotice")
              : t("refundedNotice")}
          </p>
        ) : null}

        {/* Bill to */}
        <section style={{ display: "grid", gap: 4 }}>
          <span style={muted}>{t("billTo")}</span>
          <address style={{ fontStyle: "normal", display: "grid", gap: 2 }}>
            {order.shippingAddress.label ? (
              <strong>{order.shippingAddress.label}</strong>
            ) : null}
            <span>{order.shippingAddress.line1}</span>
            {order.shippingAddress.line2 ? (
              <span>{order.shippingAddress.line2}</span>
            ) : null}
            <span>
              {order.shippingAddress.city}, {order.shippingAddress.district}
              {order.shippingAddress.postalCode
                ? ` ${order.shippingAddress.postalCode}`
                : ""}
            </span>
            <span>{order.shippingAddress.phone}</span>
            <span>{order.email}</span>
          </address>
        </section>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>{t("item")}</th>
              <th style={th}>{t("sku")}</th>
              <th style={{ ...th, textAlign: "right" }}>{t("qty")}</th>
              <th style={{ ...th, textAlign: "right" }}>{t("unitPrice")}</th>
              <th style={{ ...th, textAlign: "right" }}>{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i}>
                <td style={td}>
                  {localize(it.name, locale)}
                  {it.variantOptions && it.variantOptions.length > 0 ? (
                    <span style={{ ...muted, display: "block" }}>
                      {it.variantOptions
                        .map((o) => `${o.name}: ${o.value}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                  {it.sku}
                </td>
                <td style={{ ...td, textAlign: "right" }}>{it.qty}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {formatBDT(it.unitPriceMinor, locale)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {formatBDT(it.lineTotalMinor, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <section style={{ display: "grid", justifyContent: "end" }}>
          <div style={{ display: "grid", gap: 6, minWidth: 260 }}>
            <TotalRow
              label={t("subtotal")}
              value={formatBDT(order.subtotalMinor, locale)}
            />
            {order.discountMinor > 0 ? (
              <TotalRow
                label={t("discount")}
                value={`− ${formatBDT(order.discountMinor, locale)}`}
              />
            ) : null}
            <TotalRow
              label={t("shipping")}
              value={formatBDT(order.shippingMinor, locale)}
            />
            {order.taxMinor > 0 ? (
              <TotalRow
                label={
                  order.taxRateBp
                    ? `${t("vat")} (${order.taxRateBp / 100}%)`
                    : t("vat")
                }
                value={formatBDT(order.taxMinor, locale)}
              />
            ) : null}
            {(order.roundingMinor ?? 0) !== 0 ? (
              <TotalRow
                label={t("rounding")}
                value={`− ${formatBDT(-(order.roundingMinor ?? 0), locale)}`}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--s-4)",
                borderTop: "1px solid var(--color-border)",
                paddingTop: 8,
                fontSize: "var(--fs-md)",
              }}
            >
              <strong>{t("total")}</strong>
              <strong>{formatBDT(order.totalMinor, locale)}</strong>
            </div>
            {order.payment.status === "paid" && order.payment.paidAt ? (
              <span
                style={{
                  textAlign: "right",
                  color: "var(--color-success)",
                  fontWeight: 700,
                }}
              >
                {t("paidOn", { date: fmtDate(order.payment.paidAt) })}
              </span>
            ) : null}
          </div>
        </section>

        {/* Terms, tax + AIT note, returns, delivery */}
        <section style={{ display: "grid", gap: "var(--s-3)" }}>
          <div>
            <strong>{t("paymentTerms")}</strong>
            <p style={{ margin: "2px 0 0" }}>{terms}</p>
          </div>

          <p style={{ ...muted, margin: 0 }}>{t("taxNote")}</p>

          {aitMinor > 0 ? (
            <p style={{ ...muted, margin: 0 }}>
              {t("aitNote", {
                rate: (order.aitRateBp ?? 0) / 100,
                amount: formatBDT(aitMinor, locale),
              })}
            </p>
          ) : null}

          <div>
            <strong>{t("returnPolicy")}</strong>
            <p style={{ ...muted, margin: "2px 0 0" }}>
              {t("returnPolicyBody", { days: RETURN_WINDOW_DAYS })}
            </p>
          </div>

          {order.storefront === "instruments" ? (
            <p style={{ ...muted, margin: 0 }}>{t("deliveryNote")}</p>
          ) : null}
        </section>

        {/* Signatures */}
        <footer
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--s-5)",
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--s-4)",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            {/* TODO(client): swap for the official authorised-signatory image. */}
            <Image
              src="/signature.png"
              alt=""
              width={150}
              height={48}
              style={{ height: 48, width: "auto", objectFit: "contain" }}
            />
            <span
              style={{
                borderTop: "1px solid var(--color-text-muted)",
                paddingTop: 4,
                fontWeight: 600,
              }}
            >
              {t("authorisedSignatory")}
            </span>
            <span style={muted}>{LEGAL.name}</span>
          </div>

          <div style={{ display: "grid", gap: 4, alignContent: "end" }}>
            <span style={{ height: 48 }} aria-hidden />
            <span
              style={{
                borderTop: "1px solid var(--color-text-muted)",
                paddingTop: 4,
                fontWeight: 600,
              }}
            >
              {t("customerSignature")}
            </span>
            <span style={muted}>{t("signatureHint")}</span>
          </div>
        </footer>
      </article>
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span style={muted}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const muted: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-body-sm)",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid var(--color-text-muted)",
  fontSize: "var(--fs-body-sm)",
  color: "var(--color-text-muted)",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "8px 6px",
  borderBottom: "1px solid var(--color-hairline)",
  verticalAlign: "top",
};
