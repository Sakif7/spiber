import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container, PageHeader, Section } from "@/components/ui";
import { GuideBody } from "@/components/guide/guide-body";
import { USER_GUIDE } from "@/lib/guide/user-guide";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "pages.guide", "/guide");
}

/**
 * The customer-facing user guide. It sits beside the policies in the footer
 * because that is where people look for "how does this work" material.
 *
 * The guide body is written in English for now; on the other locales a line
 * at the top says so rather than showing a half-translated page.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.guide" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("title") }]}
      />

      <Section py="clamp(32px, 5vw, 64px)">
        <Container>
          {locale !== "en" && (
            <p className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--color-brand)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)] px-4 py-3 text-[13px] text-[var(--color-text)]">
              {t("englishOnly")}
            </p>
          )}
          <p className="mb-8 text-[13px] text-[var(--color-text-muted)]">
            {USER_GUIDE.updated}
          </p>
          <GuideBody guide={USER_GUIDE} imageBase="/guide" tone="site" />
        </Container>
      </Section>
    </>
  );
}
