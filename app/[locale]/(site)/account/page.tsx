import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Package,
  FileText,
  Heart,
  GraduationCap,
  MonitorSmartphone,
  Stethoscope,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import {
  ProfileForm,
  type ProfileInitial,
} from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";
import { formatBDT } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";
import { listOrdersByUser } from "@/lib/repositories/orders.repo";
import { getCreditAccountByUserId } from "@/lib/repositories/credit-accounts.repo";
import { bcp47 } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/quotations", label: "Quotations", icon: FileText },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/courses", label: "My courses", icon: GraduationCap },
  { href: "/account/software", label: "Software", icon: MonitorSmartphone },
  { href: "/account/cases", label: "Medical cases", icon: Stethoscope },
] as const;

const card: React.CSSProperties = {
  display: "grid",
  gap: "var(--s-4)",
  padding: "var(--s-6)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-h5)",
  fontFamily: "var(--font-display)",
  color: "var(--color-text-strong)",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = locale as Locale;

  const session = await getSessionUser();
  if (!session) {
    redirect(`/${locale}?auth=login&next=/${locale}/account`);
  }
  const doc = await findUserById(session!.sub).catch(() => null);
  if (!doc || doc.disabled) {
    redirect(`/${locale}?auth=login&next=/${locale}/account`);
  }

  const initial: ProfileInitial = {
    name: doc!.name,
    email: doc!.email,
    phone: doc!.phone ?? doc!.defaultAddress?.phone ?? "",
    address: {
      line1: doc!.defaultAddress?.line1 ?? "",
      line2: doc!.defaultAddress?.line2 ?? "",
      city: doc!.defaultAddress?.city ?? "",
      district: doc!.defaultAddress?.district ?? "",
      postalCode: doc!.defaultAddress?.postalCode ?? "",
    },
  };

  let recent: {
    orderNumber: string;
    status: string;
    totalMinor: number;
    createdAt: string | null;
  }[] = [];
  try {
    const docs = await listOrdersByUser(session!.sub);
    recent = docs.slice(0, 4).map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      totalMinor: o.totalMinor,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    }));
  } catch {
    recent = [];
  }

  // Medtrade credit facility (null when they've never applied).
  const creditAccount = await getCreditAccountByUserId(session!.sub).catch(
    () => null,
  );

  const dateFmt = new Intl.DateTimeFormat(bcp47(activeLocale), {
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <PageHeader title="My account" breadcrumbs={[{ label: "Account" }]} />
      <Section py="clamp(48px, 6vw, 80px)">
        <Container>
          <div className="equal-2col" style={{ alignItems: "start" }}>
            <div style={{ display: "grid", gap: "var(--s-5)" }}>
              <div style={card}>
                <h2 style={cardTitle}>Profile</h2>
                <ProfileForm initial={initial} />
              </div>
              <div style={card}>
                <h2 style={cardTitle}>Security</h2>
                <PasswordForm />
              </div>
            </div>

            <div style={{ display: "grid", gap: "var(--s-5)" }}>
              {/* Medtrade credit facility — status, or a way in. */}
              <div style={card}>
                <h2 style={cardTitle}>Medtrade credit</h2>
                {creditAccount && creditAccount.status === "active" ? (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    Active — you can pay on terms (Net {creditAccount.termsDays}
                    ) at Medtrade checkout.
                  </p>
                ) : creditAccount ? (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    Your credit facility is on hold. Please contact us; cash on
                    delivery is still available.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    Buy equipment now and settle on agreed terms.{" "}
                    <Link
                      href="/medtrade/credit-facility"
                      style={{
                        color: "var(--color-brand-deep)",
                        fontWeight: 600,
                      }}
                    >
                      Apply for a credit facility
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div style={card}>
                <h2 style={cardTitle}>Your account</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--s-3)",
                  }}
                >
                  {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "var(--s-3) var(--s-4)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--r-md)",
                        color: "var(--color-text-strong)",
                        textDecoration: "none",
                        fontSize: "var(--fs-body-sm)",
                        fontWeight: 600,
                        background: "var(--color-surface)",
                      }}
                    >
                      <Icon
                        size={17}
                        strokeWidth={2}
                        style={{ color: "var(--color-brand)" }}
                        aria-hidden
                      />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div style={card}>
                <h2 style={cardTitle}>Recent orders</h2>
                {recent.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-muted)",
                      fontSize: "var(--fs-body-sm)",
                    }}
                  >
                    No orders yet.{" "}
                    <Link
                      href="/kart"
                      style={{ color: "var(--color-brand-deep)" }}
                    >
                      Shop Spiber Kart
                    </Link>
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: "var(--s-2)" }}>
                    {recent.map((o) => (
                      <Link
                        key={o.orderNumber}
                        href={`/account/orders/${o.orderNumber}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "var(--s-3)",
                          padding: "var(--s-2) 0",
                          borderBottom: "1px solid var(--color-hairline)",
                          textDecoration: "none",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-caption)",
                            color: "var(--color-brand-deep)",
                            fontWeight: 600,
                          }}
                        >
                          {o.orderNumber}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-caption)",
                            color: "var(--color-text-muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          {o.status}
                          {o.createdAt
                            ? ` · ${dateFmt.format(new Date(o.createdAt))}`
                            : ""}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-caption)",
                            color: "var(--color-text-strong)",
                          }}
                        >
                          {formatBDT(o.totalMinor, activeLocale)}
                        </span>
                      </Link>
                    ))}
                    <Link
                      href="/account/orders"
                      style={{
                        marginTop: "var(--s-2)",
                        fontSize: "var(--fs-body-sm)",
                        fontWeight: 600,
                        color: "var(--color-brand-deep)",
                      }}
                    >
                      View all orders →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
