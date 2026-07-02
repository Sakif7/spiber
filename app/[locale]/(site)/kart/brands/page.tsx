import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { KART_HOME_IMAGES } from "@/lib/hero-images";
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
  const t = await getTranslations({ locale, namespace: "marketplace.brands" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/kart/brands",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function KartBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const nav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "marketplace.brands" });

  let raw: Awaited<ReturnType<typeof listBrands>> = [];
  try {
    raw = await listBrands();
  } catch (e) {
    logger.warn("kart brands load failed", e);
  }
  const brands = raw.map((b) => ({
    id: String(b._id),
    name: localize(b.name, l),
    logo: b.logo,
  }));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("lede")}
        images={KART_HOME_IMAGES}
        imageAlt={t("title")}
        stats={[{ value: String(brands.length), label: t("count") }]}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("marketplace"), href: "/kart" },
          { label: t("breadcrumb") },
        ]}
      />
      <Section py="clamp(40px, 5vw, 80px)">
        <Container>
          {brands.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "var(--s-8)",
                textAlign: "center",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
              }}
            >
              {t("empty")}
            </p>
          ) : (
            <div className="kart-brand-dir">
              {brands.map((b) => {
                const monogram =
                  b.name
                    .replace(/[^\p{L}\p{N}]/gu, "")
                    .slice(0, 2)
                    .toUpperCase() || "•";
                return (
                  <Link
                    key={b.id}
                    href={`/kart/shop?brand=${b.id}`}
                    className="kart-brand-dir-tile"
                    title={b.name}
                  >
                    <span className="kart-brand-dir-logo">
                      {b.logo ? (
                        <Image
                          src={b.logo}
                          alt={b.name}
                          fill
                          sizes="160px"
                          style={{ objectFit: "contain" }}
                        />
                      ) : (
                        <span className="kart-brand-mono">{monogram}</span>
                      )}
                    </span>
                    <span className="kart-brand-dir-name">{b.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
