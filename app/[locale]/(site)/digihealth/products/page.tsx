import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { SoftwareCard } from "@/components/systems/software-card";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { HERO } from "@/lib/hero-images";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "systems.catalog" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/digihealth/products",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function SoftwareCatalog({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "systems" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const q = str((await searchParams).q);

  let items: Awaited<ReturnType<typeof listSoftwareProducts>>["items"] = [];
  let total = 0;
  try {
    const res = await listSoftwareProducts({
      status: "active",
      search: q,
      pageSize: 60,
    });
    items = res.items;
    total = res.total;
  } catch (e) {
    logger.warn("software catalog load failed", e);
  }

  // True empty catalog (no search active) → branded "coming soon".
  const emptyCatalog = total === 0 && !q;

  return (
    <>
      <PageHeader
        eyebrow={t("hub.title")}
        title={t("catalog.title")}
        description={t("catalog.lede")}
        image={HERO.systemsHub}
        imageAlt={t("catalog.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title"), href: "/digihealth" },
          { label: t("catalog.title") },
        ]}
      />
      {emptyCatalog ? (
        <ComingSoon />
      ) : (
        <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
          <Container style={{ display: "grid", gap: "var(--s-6)" }}>
            <form
              action={`/${locale}/digihealth/products`}
              method="get"
              role="search"
              style={{ display: "flex", gap: 8, maxWidth: 520 }}
            >
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder={t("catalog.searchPlaceholder")}
                aria-label={t("catalog.search")}
                style={{
                  flex: 1,
                  height: 46,
                  padding: "0 16px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-pill)",
                  background: "var(--color-surface)",
                  font: "inherit",
                }}
              />
              <button
                type="submit"
                style={{
                  height: 46,
                  padding: "0 22px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--color-brand)",
                  color: "#fff",
                  border: 0,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("catalog.search")}
              </button>
            </form>

            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("catalog.results", { count: total })}
            </p>

            {items.length === 0 ? (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-lg)",
                  padding: "var(--s-10)",
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                }}
              >
                {t("catalog.noResults")}
              </div>
            ) : (
              <CardGrid columns={3}>
                {items.map((p) => (
                  <SoftwareCard key={String(p._id)} product={p} locale={l} />
                ))}
              </CardGrid>
            )}
          </Container>
        </section>
      )}
    </>
  );
}
