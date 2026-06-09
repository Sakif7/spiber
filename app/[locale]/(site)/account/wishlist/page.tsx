import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CardGrid } from "@/components/ui/card-grid";
import { CtaButton } from "@/components/ui/cta-button";
import { ProductCard } from "@/components/shop/product-card";
import { listWishlistProducts } from "@/lib/repositories/wishlist.repo";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "shop.wishlist" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}?auth=login&next=/${locale}/account/wishlist`);
  }

  let items: Awaited<ReturnType<typeof listWishlistProducts>> = [];
  let brandMap = new Map<string, string>();
  try {
    const [ws, bs] = await Promise.all([
      listWishlistProducts(user.sub),
      listBrands(),
    ]);
    items = ws;
    brandMap = new Map(bs.map((b) => [String(b._id), localize(b.name, l)]));
  } catch (e) {
    logger.warn("wishlist load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={nav("instruments")}
        title={t("title")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          {items.length === 0 ? (
            <div
              style={{
                display: "grid",
                gap: "var(--s-5)",
                justifyItems: "start",
              }}
            >
              <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
              <CtaButton href="/medtrade">{t("browse")}</CtaButton>
            </div>
          ) : (
            <CardGrid columns={4}>
              {items.map((p) => (
                <ProductCard
                  key={String(p._id)}
                  product={p}
                  locale={l}
                  brandName={
                    p.brandId ? brandMap.get(String(p.brandId)) : undefined
                  }
                  wishlisted
                />
              ))}
            </CardGrid>
          )}
        </Container>
      </section>
    </>
  );
}
