import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/shop/product-card";
import { listProducts } from "@/lib/repositories/products.repo";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop.hub" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/instruments",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function InstrumentsHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "shop.hub" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const hub = await getTranslations({ locale, namespace: "hubs.instruments" });

  let products: Awaited<ReturnType<typeof listProducts>>["items"] = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    const [p, c] = await Promise.all([
      listProducts({ status: "active", pageSize: 8 }),
      listCategories(),
    ]);
    products = p.items;
    categories = c;
  } catch (e) {
    logger.warn("instruments hub data load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={hub("eyebrow")}
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      {products.length === 0 ? (
        <ComingSoon />
      ) : (
        <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
          <Container
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-10)",
            }}
          >
            {categories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {categories.map((c) => (
                  <Link
                    key={String(c._id)}
                    href={`/instruments/${c.slug}`}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--r-pill)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      fontSize: "var(--fs-body-sm)",
                    }}
                  >
                    {localize(c.name, l)}
                  </Link>
                ))}
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-6)",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--fs-h3)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("featured")}
              </h2>
              <CardGrid columns={4}>
                {products.map((p) => (
                  <ProductCard key={String(p._id)} product={p} locale={l} />
                ))}
              </CardGrid>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
