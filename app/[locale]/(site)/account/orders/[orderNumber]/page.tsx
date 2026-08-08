import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUser } from "@/lib/auth/current-user";
import { getOrderByNumber } from "@/lib/repositories/orders.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { computeSelfService } from "@/lib/services/order.service";
import { OrderSelfService } from "@/components/account/order-self-service";
import type { Locale } from "@/i18n/routing";
import type { IOrder } from "@/lib/models/order";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-text-muted)",
  paid: "var(--color-brand)",
  processing: "var(--color-brand)",
  shipped: "var(--color-brand-deep)",
  delivered: "var(--color-success)",
  cancelled: "var(--color-error)",
  refunded: "var(--color-error)",
};

function formatDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${loc}?auth=login&next=/${loc}/account/orders/${encodeURIComponent(orderNumber)}`,
    );
  }

  let order: Awaited<ReturnType<typeof getOrderByNumber>> = null;
  try {
    order = await getOrderByNumber(orderNumber);
  } catch {
    order = null;
  }

  if (!order || String(order.userId ?? "") !== user.sub) {
    notFound();
  }

  const o = order.toObject() as IOrder;
  const selfService = computeSelfService(o);

  const statusColor = STATUS_COLORS[o.status] ?? "var(--color-text-muted)";

  const sectionTitleStyle = {
    fontSize: "var(--fs-h4)",
    color: "var(--color-text-strong)",
    fontFamily: "var(--font-display)",
    marginBottom: "var(--s-4)",
  } as const;

  const cardStyle = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-lg)",
    padding: "var(--s-6)",
  } as const;

  return (
    <>
      <PageHeader
        title={`#${o.orderNumber}`}
        eyebrow={`Order placed ${formatDate(o.createdAt)}`}
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: "Orders", href: "/account/orders" },
          { label: `#${o.orderNumber}` },
        ]}
      />

      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container narrow>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-8)",
            }}
          >
            {/* Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "var(--fs-small)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Status
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "var(--s-1) var(--s-3)",
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${statusColor}`,
                  color: statusColor,
                  fontSize: "var(--fs-small)",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {o.status}
              </span>
              {o.trackingNumber && (
                <span
                  style={{
                    fontSize: "var(--fs-small)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Tracking:{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text)",
                    }}
                  >
                    {o.trackingNumber}
                  </span>
                </span>
              )}
            </div>

            {/* Items */}
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Items</h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-3)",
                }}
              >
                {o.items.map((item, i) => (
                  <div
                    key={`${item.productSnapshot.sku}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "var(--s-4)",
                      paddingBottom: "var(--s-3)",
                      borderBottom:
                        i < o.items.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--s-1)",
                      }}
                    >
                      <span style={{ color: "var(--color-text-strong)" }}>
                        {localize(item.productSnapshot.name, loc)}
                      </span>
                      {(item.productSnapshot.variantOptions?.length ?? 0) >
                        0 && (
                        <span
                          style={{
                            fontSize: "var(--fs-small)",
                            color: "var(--color-text)",
                          }}
                        >
                          {item.productSnapshot
                            .variantOptions!.map(
                              (opt) => `${opt.name}: ${opt.value}`,
                            )
                            .join(" · ")}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "var(--fs-small)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {item.productSnapshot.sku}
                        </span>
                        {"  ·  "}
                        {formatBDT(item.productSnapshot.priceMinor, loc)} ×{" "}
                        {item.qty}
                      </span>
                    </div>
                    <span
                      style={{
                        color: "var(--color-text)",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatBDT(item.lineTotalMinor, loc)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Summary</h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <TotalRow
                  label="Subtotal"
                  value={formatBDT(o.subtotalMinor, loc)}
                />
                <TotalRow
                  label="Shipping"
                  value={
                    o.shippingMinor === 0
                      ? "Free"
                      : formatBDT(o.shippingMinor, loc)
                  }
                />
                {o.discountMinor > 0 && (
                  <TotalRow
                    label="Discount"
                    value={`− ${formatBDT(o.discountMinor, loc)}`}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "var(--s-2)",
                    paddingTop: "var(--s-3)",
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "var(--fs-body-lg)",
                    fontWeight: 600,
                    color: "var(--color-text-strong)",
                  }}
                >
                  <span>Total</span>
                  <span>{formatBDT(o.totalMinor, loc)}</span>
                </div>
              </div>
            </div>

            {/* Shipping address */}
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Shipping to</h2>
              <address
                style={{
                  fontStyle: "normal",
                  color: "var(--color-text)",
                  lineHeight: "var(--lh-body)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {o.shippingAddress.label && (
                  <span>{o.shippingAddress.label}</span>
                )}
                <span>{o.shippingAddress.line1}</span>
                {o.shippingAddress.line2 && (
                  <span>{o.shippingAddress.line2}</span>
                )}
                <span>
                  {o.shippingAddress.city}, {o.shippingAddress.district}
                  {o.shippingAddress.postalCode
                    ? ` ${o.shippingAddress.postalCode}`
                    : ""}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {o.shippingAddress.phone}
                </span>
              </address>
            </div>

            {/* Self-service: cancel / refund request */}
            {(selfService.canCancel ||
              selfService.canRequestRefund ||
              selfService.refundWindowClosed ||
              selfService.refundRequestedAt) && (
              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>Need help with this order?</h2>
                <OrderSelfService
                  orderNumber={o.orderNumber}
                  selfService={selfService}
                />
              </div>
            )}

            {/* Timeline */}
            {o.timeline && o.timeline.length > 0 && (
              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>Timeline</h2>
                <ol
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--s-4)",
                  }}
                >
                  {o.timeline.map((entry, i) => (
                    <li
                      key={`${entry.status}-${i}`}
                      style={{
                        display: "flex",
                        gap: "var(--s-3)",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          marginTop: 6,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background:
                            STATUS_COLORS[entry.status] ??
                            "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--color-text-strong)",
                            textTransform: "capitalize",
                            fontWeight: 600,
                            fontSize: "var(--fs-small)",
                          }}
                        >
                          {entry.status}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-small)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {formatDate(entry.at)}
                        </span>
                        {entry.note && (
                          <span
                            style={{
                              fontSize: "var(--fs-small)",
                              color: "var(--color-text)",
                            }}
                          >
                            {entry.note}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        color: "var(--color-text)",
      }}
    >
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
