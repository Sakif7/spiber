import { getTranslations } from "next-intl/server";
import { PageHeader } from "./page-header";
import { ComingSoon } from "./coming-soon";
import { HERO } from "@/lib/hero-images";
import type { Locale } from "@/i18n/routing";

// Hero photo per division (others fall back to the plain text header).
const DIVISION_HERO: Record<string, string | undefined> = {
  tourism: HERO.tourismHub,
  consulting: HERO.consultingHub,
};

/**
 * Standard division/blog hub: localized page header + branded "Coming soon"
 * empty state. Reads copy from the `hubs.<division>` catalog namespace.
 */
export async function DivisionHub({
  locale,
  division,
}: {
  locale: Locale;
  division: string;
}) {
  const t = await getTranslations({ locale, namespace: `hubs.${division}` });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        image={DIVISION_HERO[division]}
        imageAlt={t("title")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <ComingSoon />
    </>
  );
}
