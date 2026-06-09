import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { QuoteForm } from "@/components/instruments/quote-form";
import { getSessionUser } from "@/lib/auth/current-user";
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
  const t = await getTranslations({ locale, namespace: "quotation" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/medtrade/quote",
    title: t("pageTitle"),
    description: t("pageLede"),
    noindex: true,
  });
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "quotation" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const session = await getSessionUser().catch(() => null);
  let initialContact:
    | { name?: string; email?: string; organization?: string; phone?: string }
    | undefined;
  if (session) {
    const user = await findUserById(session.sub).catch(() => null);
    initialContact = {
      name: user?.name ?? undefined,
      email: user?.email ?? session.email,
    };
  }

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageLede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/medtrade" },
          { label: t("pageTitle") },
        ]}
      />
      <Section py="clamp(40px, 5vw, 72px)">
        <Container>
          <QuoteForm initialContact={initialContact} />
        </Container>
      </Section>
    </>
  );
}
