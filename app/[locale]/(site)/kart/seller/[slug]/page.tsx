import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CardGrid } from "@/components/ui/card-grid";
import { ProductCard } from "@/components/shop/product-card";
import { getSellerBySlug } from "@/lib/repositories/sellers.repo";
import { listProducts } from "@/lib/repositories/products.repo";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const seller = await getSellerBySlug(slug).catch(() => null);
  const t = await getTranslations({ locale, namespace: "becomeSeller.store" });
  const title = seller?.displayName ?? t("eyebrow");
  return pageMetadata({
    locale: locale as Locale,
    path: `/kart/seller/${slug}`,
    title,
    image: seller?.logo || undefined,
    noindex: !seller,
  });
}

export default async function SellerStorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  // Degrade gracefully: a missing slug OR a transient DB read error → 404
  // rather than an unserializable 500.
  const seller = await getSellerBySlug(slug).catch(() => null);
  if (!seller) notFound();

  const nav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "becomeSeller.store" });

  const { items } = await listProducts({
    storefront: "marketplace",
    status: "active",
    sellerId: String(seller._id),
    pageSize: 24,
  }).catch(() => ({
    items: [] as Awaited<ReturnType<typeof listProducts>>["items"],
  }));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={seller.displayName}
        image={seller.logo || undefined}
        imageAlt={seller.displayName}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/kart" },
          { label: seller.displayName },
        ]}
      />

      <Section py="clamp(40px, 5vw, 80px)">
        <Container>
          {items.length === 0 ? (
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
                padding: "var(--s-8)",
                textAlign: "center",
                color: "var(--color-text-muted)",
              }}
            >
              {t("empty")}
            </div>
          ) : (
            <>
              <h2
                style={{
                  fontSize: "var(--fs-h3)",
                  lineHeight: "var(--lh-heading)",
                  letterSpacing: "var(--tracking-heading)",
                  color: "var(--color-text-strong)",
                  marginBottom: "var(--s-6)",
                }}
              >
                {t("productsBy", { name: seller.displayName })}
              </h2>
              <CardGrid columns={4}>
                {items.map((product) => (
                  <ProductCard
                    key={String(product._id)}
                    product={product}
                    locale={l}
                    mode="marketplace"
                  />
                ))}
              </CardGrid>
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
