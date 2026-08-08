import { setRequestLocale, getTranslations } from "next-intl/server";
import { Store, LayoutGrid, Banknote } from "lucide-react";
import type { CSSProperties } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CardGrid } from "@/components/ui/card-grid";
import { CtaButton } from "@/components/ui/cta-button";
import { SellerApplyForm } from "@/components/seller/seller-apply-form";
import { getSessionUser } from "@/lib/auth/current-user";
import { getSellerByUserId } from "@/lib/repositories/sellers.repo";
import { getOpenApplicationByUser } from "@/lib/repositories/seller-applications.repo";
import { findUserById } from "@/lib/repositories/users.repo";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "becomeSeller.hero" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/become-a-seller",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function BecomeASellerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "becomeSeller" });

  const user = await getSessionUser().catch(() => null);
  const seller = user
    ? await getSellerByUserId(user.sub).catch(() => null)
    : null;
  const openApplication =
    user && !seller
      ? await getOpenApplicationByUser(user.sub).catch(() => null)
      : null;
  // Prefill the form from the account (claims carry email; name needs the doc).
  const account =
    user && !seller && !openApplication
      ? await findUserById(user.sub).catch(() => null)
      : null;

  const benefits = [
    {
      icon: Store,
      title: t("benefits.reachTitle"),
      note: t("benefits.reachNote"),
    },
    {
      icon: LayoutGrid,
      title: t("benefits.easyTitle"),
      note: t("benefits.easyNote"),
    },
    {
      icon: Banknote,
      title: t("benefits.payoutsTitle"),
      note: t("benefits.payoutsNote"),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hero.breadcrumb") },
        ]}
      />

      <Section py="clamp(40px, 5vw, 80px)">
        <Container>
          <h2
            style={{
              fontSize: "var(--fs-h3)",
              lineHeight: "var(--lh-heading)",
              letterSpacing: "var(--tracking-heading)",
              color: "var(--color-text-strong)",
              marginBottom: "var(--s-6)",
            }}
          >
            {t("benefits.title")}
          </h2>
          <CardGrid columns={3}>
            {benefits.map(({ icon: Icon, title, note }) => (
              <div
                key={title}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "var(--s-6)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-lg)",
                  background: "var(--color-surface)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: "var(--r-md)",
                    background:
                      "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                    color: "var(--color-brand-deep)",
                  }}
                >
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <h3
                  style={{
                    fontSize: "var(--fs-h5)",
                    color: "var(--color-text-strong)",
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: "var(--color-text-muted)" }}>{note}</p>
              </div>
            ))}
          </CardGrid>
        </Container>
      </Section>

      <Section
        py="clamp(40px, 5vw, 80px)"
        style={{ background: "var(--color-surface-2)" }}
      >
        <Container style={{ maxWidth: 720 }}>
          {!user ? (
            <StateCard>
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("form.loginPrompt")}
              </p>
              <div>
                <CtaButton href="/?auth=login&next=%2Fbecome-a-seller">
                  {t("form.signIn")}
                </CtaButton>
              </div>
            </StateCard>
          ) : seller ? (
            <StateCard>
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("form.alreadySeller")}
              </p>
              <div>
                <CtaButton href="/seller">{t("form.goToDashboard")}</CtaButton>
              </div>
            </StateCard>
          ) : openApplication ? (
            <StateCard>
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("form.alreadyApplied")}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "var(--s-5)",
                  flexWrap: "wrap",
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>
                  {t("form.appliedRef")}{" "}
                  <strong
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-strong)",
                    }}
                  >
                    {openApplication.applicationNumber}
                  </strong>
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {t("form.appliedStatus")}{" "}
                  <strong
                    style={{
                      color: "var(--color-brand-deep)",
                      textTransform: "capitalize",
                    }}
                  >
                    {openApplication.status}
                  </strong>
                </span>
              </div>
            </StateCard>
          ) : (
            <SellerApplyForm
              defaultName={account?.name ?? ""}
              defaultEmail={account?.email ?? user?.email ?? ""}
            />
          )}
        </Container>
      </Section>
    </>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <div style={stateCardStyle}>{children}</div>;
}

const stateCardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-6)",
  display: "grid",
  gap: "var(--s-4)",
};
