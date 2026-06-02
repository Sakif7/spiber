import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/current-user";
import { listOrdersByUser } from "@/lib/repositories/orders.repo";

export const dynamic = "force-dynamic";

type OrderRow = {
  orderNumber: string;
  status: string;
  totalMinor: number;
  createdAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-text-muted)",
  paid: "var(--color-brand)",
  processing: "var(--color-brand)",
  shipped: "var(--color-brand-deep)",
  delivered: "var(--color-success)",
  cancelled: "var(--color-error)",
  refunded: "var(--color-error)",
};

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function AccountOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = locale as Locale;

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=/${locale}/account/orders`);
  }

  let orders: OrderRow[] = [];
  try {
    const docs = await listOrdersByUser(user.sub);
    orders = docs.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      totalMinor: o.totalMinor,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    }));
  } catch {
    orders = [];
  }

  return (
    <>
      <PageHeader
        title="My orders"
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: "Orders" },
        ]}
      />
      <Section py="clamp(48px, 6vw, 80px)">
        <Container>
          {orders.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "var(--s-4)",
                padding: "var(--s-8)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
              }}
            >
              <p
                style={{
                  fontSize: "var(--fs-body-lg)",
                  color: "var(--color-text-strong)",
                }}
              >
                You have no orders yet.
              </p>
              <p
                style={{
                  fontSize: "var(--fs-body)",
                  color: "var(--color-text-muted)",
                  maxWidth: "48ch",
                }}
              >
                Browse our medical instruments and place your first order.
              </p>
              <CtaButton href="/instruments" variant="primary">
                Shop instruments
              </CtaButton>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--fs-body)",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={thStyle}>Order #</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.orderNumber}>
                      <td style={tdStyle}>
                        <Link
                          href={`/account/orders/${order.orderNumber}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-brand-deep)",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td
                        style={{ ...tdStyle, color: "var(--color-text-muted)" }}
                      >
                        {formatDate(order.createdAt, activeLocale)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            textTransform: "capitalize",
                            color:
                              STATUS_COLORS[order.status] ??
                              "var(--color-text)",
                            fontWeight: 600,
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {formatBDT(order.totalMinor, activeLocale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};
