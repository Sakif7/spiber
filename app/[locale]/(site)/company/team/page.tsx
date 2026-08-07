import { getTranslations, setRequestLocale } from "next-intl/server";

import { Container, PageHeader, Section } from "@/components/ui";
import { TeamGrid } from "@/components/sections/team-grid";
import { CompanyTabs } from "@/components/layout/section-tabs";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "pages.team", "/company/team");
}

export default async function ManagingBodyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages.team" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        image="/smiling-medical-team-portrait.jpeg"
        imageAlt={t("title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: t("breadcrumb") },
        ]}
      />
      <CompanyTabs />

      <Section>
        <Container>
          {/* Everyone, 3 x 2. At the previous 5 columns a sixth member left a
              single orphan card stranded on row two; three columns is
              symmetric for six people AND renders the cards larger, which
              suits a dedicated team page. */}
          <TeamGrid columns={3} />
        </Container>
      </Section>
    </>
  );
}
