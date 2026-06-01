import { getTranslations } from "next-intl/server";
import { PageHeader } from "./page-header";
import { ComingSoon } from "./coming-soon";
import type { Locale } from "@/i18n/routing";

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
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <ComingSoon />
    </>
  );
}
