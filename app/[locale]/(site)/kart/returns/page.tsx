import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";

// NOTE: policy COPY is a sensible draft for Bangladesh e-commerce norms —
// flag for client review before launch. The 7-day figure must stay in sync
// with RETURN_WINDOW_DAYS (lib/schemas/order.ts), which drives refund
// eligibility on delivered orders.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "returns" });
  return { title: t("title"), description: t("lede") };
}

const SECTION_KEYS = [
  "cancel",
  "refund",
  "method",
  "exclusions",
  "contact",
] as const;

export default async function KartReturnsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "returns" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/kart" },
          { label: t("title") },
        ]}
      />
      <Section py="clamp(48px, 6vw, 88px)">
        <Container narrow>
          <div style={{ display: "grid", gap: "var(--s-7)", maxWidth: "70ch" }}>
            {SECTION_KEYS.map((key) => (
              <section key={key} style={{ display: "grid", gap: "var(--s-3)" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-h4)",
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text-strong)",
                  }}
                >
                  {t(`${key}Title`)}
                </h2>
                {t(`${key}Body`)
                  .split("\n")
                  .map((para, i) => (
                    <p
                      key={i}
                      style={{
                        margin: 0,
                        color: "var(--color-text)",
                        lineHeight: "var(--lh-body)",
                      }}
                    >
                      {para}
                    </p>
                  ))}
              </section>
            ))}
            <p
              style={{
                margin: 0,
                paddingTop: "var(--s-4)",
                borderTop: "1px solid var(--color-hairline)",
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("ordersHint")}{" "}
              <Link
                href="/account/orders"
                style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
              >
                {t("ordersLink")}
              </Link>
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
