import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/repositories/orders.repo";
import { Link } from "@/i18n/navigation";
import { formatBDT } from "@/lib/money";
import { OrderActions } from "@/components/admin/order-actions";

/** How the order is paid, in plain words for the admin summary. */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  offline: "Offline (bank transfer / arranged)",
  cod: "Cash on delivery",
  credit: "Credit account",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

type LocalizedField = { en: string; bn?: string };

type PlainItem = {
  productSnapshot: { name: LocalizedField; sku: string; priceMinor: number };
  qty: number;
  lineTotalMinor: number;
};

type PlainTimeline = {
  status: string;
  at: string | Date;
  note?: string;
  internalNote?: string;
};

type PlainOrder = {
  _id: unknown;
  orderNumber: string;
  email: string;
  status: string;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  /** VAT rate actually charged, in basis points (null = none). */
  taxRateBp?: number | null;
  totalMinor: number;
  storefront?: "instruments" | "marketplace";
  items: PlainItem[];
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    district: string;
    postalCode?: string;
    phone: string;
  };
  payment: {
    provider: string;
    status: string;
    paidAt?: string | Date;
    /** offline | cod | credit — absent on legacy orders. */
    method?: string;
    termsDays?: number | null;
    dueAt?: string | Date | null;
  };
  trackingNumber?: string;
  refundRequest?: {
    reason: string;
    requestedAt: string | Date;
    status: "open" | "resolved";
  } | null;
  timeline: PlainTimeline[];
  createdAt: string | Date;
};

const sectionCard: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--fs-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 var(--s-4) 0",
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-lg)",
  color: "var(--color-text-strong)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--s-2) var(--s-3)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--fs-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "var(--s-2) var(--s-3)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text)",
};

function fmtDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        fontSize: "var(--fs-xs)",
        fontWeight: 600,
        textTransform: "capitalize",
        color: "var(--color-text-strong)",
      }}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <span
        style={{ fontSize: "var(--fs-sm)", color: "var(--color-text-strong)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  let order: PlainOrder | null = null;
  try {
    const doc = await getOrderById(id);
    if (doc) order = doc.toObject() as unknown as PlainOrder;
  } catch {
    order = null;
  }

  if (!order) notFound();
  const o = order;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <div
        className="admin-no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/admin/orders"
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--color-text-muted)",
              textDecoration: "none",
            }}
          >
            ← Back to orders
          </Link>
          <h1
            style={{
              margin: "var(--s-2) 0 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-2xl)",
              color: "var(--color-text-strong)",
            }}
          >
            Order {o.orderNumber}
          </h1>
        </div>
      </div>

      {/* Printable invoice region */}
      <div
        className="admin-invoice"
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
      >
        <section style={sectionCard}>
          <h2 style={headingStyle}>Summary</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--s-4)",
            }}
          >
            <Field label="Order number" value={o.orderNumber} />
            <Field label="Placed" value={fmtDate(o.createdAt)} />
            <Field
              label="Store"
              value={
                o.storefront === "instruments" ? "Medtrade" : "Spiber Kart"
              }
            />
            <Field label="Status" value={<StatusPill>{o.status}</StatusPill>} />
            <Field
              label="Payment"
              value={
                <span style={{ textTransform: "capitalize" }}>
                  {o.payment?.status ?? "—"}
                  {o.payment?.provider ? ` · ${o.payment.provider}` : ""}
                </span>
              }
            />
            <Field
              label="Method"
              value={PAYMENT_METHOD_LABEL[o.payment?.method ?? "offline"]}
            />
            {o.payment?.dueAt ? (
              <Field
                label={`Payment due${
                  o.payment.termsDays ? ` (Net ${o.payment.termsDays})` : ""
                }`}
                value={fmtDate(o.payment.dueAt)}
              />
            ) : null}
            {o.payment?.paidAt ? (
              <Field label="Paid at" value={fmtDate(o.payment.paidAt)} />
            ) : null}
            <Field label="Customer email" value={o.email} />
            {o.trackingNumber ? (
              <Field
                label="Tracking"
                value={
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {o.trackingNumber}
                  </span>
                }
              />
            ) : null}
          </div>
        </section>

        <section style={sectionCard}>
          <h2 style={headingStyle}>Shipping address</h2>
          <address
            style={{
              fontStyle: "normal",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.6,
              color: "var(--color-text)",
            }}
          >
            {o.shippingAddress.label ? (
              <div style={{ color: "var(--color-text-muted)" }}>
                {o.shippingAddress.label}
              </div>
            ) : null}
            <div>{o.shippingAddress.line1}</div>
            {o.shippingAddress.line2 ? (
              <div>{o.shippingAddress.line2}</div>
            ) : null}
            <div>
              {o.shippingAddress.city}, {o.shippingAddress.district}
              {o.shippingAddress.postalCode
                ? ` ${o.shippingAddress.postalCode}`
                : ""}
            </div>
            <div style={{ fontFamily: "var(--font-mono)" }}>
              {o.shippingAddress.phone}
            </div>
          </address>
        </section>

        <section style={sectionCard}>
          <h2 style={headingStyle}>Items</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Unit</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item, idx) => (
                  <tr key={`${item.productSnapshot.sku}-${idx}`}>
                    <td
                      style={{ ...tdStyle, color: "var(--color-text-strong)" }}
                    >
                      {item.productSnapshot.name?.en ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                      {item.productSnapshot.sku}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatBDT(item.productSnapshot.priceMinor)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {item.qty}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatBDT(item.lineTotalMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: "var(--s-4)",
              marginLeft: "auto",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
            }}
          >
            <TotalRow label="Subtotal" value={formatBDT(o.subtotalMinor)} />
            <TotalRow label="Shipping" value={formatBDT(o.shippingMinor)} />
            <TotalRow
              label="Discount"
              value={
                o.discountMinor > 0
                  ? `− ${formatBDT(o.discountMinor)}`
                  : formatBDT(0)
              }
            />
            {o.taxMinor > 0 ? (
              <TotalRow
                label={o.taxRateBp ? `VAT (${o.taxRateBp / 100}%)` : "VAT"}
                value={formatBDT(o.taxMinor)}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "var(--s-2)",
                borderTop: "1px solid var(--color-border)",
                fontSize: "var(--fs-md)",
                fontWeight: 700,
                color: "var(--color-text-strong)",
              }}
            >
              <span>Total</span>
              <span>{formatBDT(o.totalMinor)}</span>
            </div>
          </div>
        </section>

        {o.refundRequest ? (
          <section
            style={{
              ...sectionCard,
              borderColor:
                o.refundRequest.status === "open"
                  ? "var(--color-secondary)"
                  : "var(--color-border)",
            }}
          >
            <h2 style={headingStyle}>
              Refund request{" "}
              <span
                style={{
                  fontSize: "var(--fs-sm)",
                  fontWeight: 600,
                  color:
                    o.refundRequest.status === "open"
                      ? "var(--color-secondary)"
                      : "var(--color-text-muted)",
                }}
              >
                · {o.refundRequest.status}
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)" }}>
              Requested {fmtDate(o.refundRequest.requestedAt)} —{" "}
              {o.refundRequest.reason}
            </p>
            {o.refundRequest.status === "open" ? (
              <p
                style={{
                  margin: "var(--s-2) 0 0",
                  fontSize: "var(--fs-sm)",
                  color: "var(--color-text-muted)",
                }}
              >
                Settle it with the Cancel/Refund actions below — the request
                resolves automatically.
              </p>
            ) : null}
          </section>
        ) : null}

        <section style={sectionCard}>
          <h2 style={headingStyle}>Timeline</h2>
          {o.timeline.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-sm)",
              }}
            >
              No timeline events.
            </p>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-3)",
              }}
            >
              {o.timeline.map((event, idx) => (
                <li
                  key={`${event.status}-${idx}`}
                  style={{
                    display: "flex",
                    gap: "var(--s-3)",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <StatusPill>{event.status}</StatusPill>
                  <span
                    style={{
                      fontSize: "var(--fs-sm)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {fmtDate(event.at)}
                  </span>
                  {event.note ? (
                    <span
                      style={{
                        fontSize: "var(--fs-sm)",
                        color: "var(--color-text)",
                      }}
                    >
                      — {event.note}
                    </span>
                  ) : null}
                  {event.internalNote ? (
                    <span
                      style={{
                        fontSize: "var(--fs-sm)",
                        color: "var(--color-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      (internal: {event.internalNote})
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <OrderActions
        orderId={String(o._id)}
        status={o.status}
        paymentMethod={o.payment?.method ?? "offline"}
        paymentStatus={o.payment?.status ?? "unpaid"}
      />
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "var(--fs-sm)",
        color: "var(--color-text)",
      }}
    >
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
