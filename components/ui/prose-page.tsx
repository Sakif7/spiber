import { getTranslations } from "next-intl/server";
import { Container } from "./container";
import { PageHeader } from "./page-header";
import type { Locale } from "@/i18n/routing";

/**
 * Simple interior content page (about, legal): localized header + a prose body.
 * Reads `title`, `description`, and `body` from the given catalog namespace.
 */
export async function ProsePage({
  locale,
  namespace,
}: {
  locale: Locale;
  namespace: string;
}) {
  const t = await getTranslations({ locale, namespace });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
        <Container narrow>
          <p
            style={{
              fontSize: "var(--fs-body-lg)",
              color: "var(--color-text)",
              lineHeight: "var(--lh-body)",
            }}
          >
            {t("body")}
          </p>
        </Container>
      </section>
    </>
  );
}
