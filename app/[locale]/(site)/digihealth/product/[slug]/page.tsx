import { notFound } from "next/navigation";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { Placeholder } from "@/components/ui/placeholder";
import { ZoomImage } from "@/components/ui/zoom-image";
import { CtaButton } from "@/components/ui/cta-button";
import { RecentlyViewed } from "@/components/ui/recently-viewed";
import { SoftwareBuyButton } from "@/components/systems/software-buy-button";
import { SoftwareCard } from "@/components/systems/software-card";
import { InquiryForm } from "@/components/systems/inquiry-form";
import {
  getSoftwareProductBySlug,
  listRelatedSoftware,
} from "@/lib/repositories/software.repo";
import { hasPaidPurchase } from "@/lib/repositories/purchases.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { formatBDT, fromMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/lib/site-config";
import { localePath } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getSoftwareProductBySlug(slug).catch(() => null);
  if (!product) return {};
  return pageMetadata({
    locale: locale as Locale,
    path: `/digihealth/product/${slug}`,
    title: localize(product.name, locale as Locale),
    description: product.description
      ? localize(product.description, locale as Locale)
      : undefined,
    image: product.screenshots?.[0],
  });
}

export default async function SoftwareDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const localeBase = siteConfig.url + localePath(l, "/").replace(/\/$/, "");
  const t = await getTranslations({ locale, namespace: "systems" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const product = await getSoftwareProductBySlug(slug).catch(() => null);
  if (!product || product.status !== "active") notFound();

  const name = localize(product.name, l);
  const isQuote = product.pricingModel === "quote";

  const user = await getSessionUser();
  const owned =
    user && !isQuote
      ? await hasPaidPurchase(user.sub, String(product._id))
      : false;

  const related = await listRelatedSoftware(String(product._id), {
    categoryId: product.categoryId ? String(product.categoryId) : null,
  }).catch(() => []);

  const priceLabel = isQuote
    ? t("pricing.quote")
    : product.priceMinor
      ? formatBDT(product.priceMinor, l)
      : t("pricing.free");

  const deliveryNote =
    product.deliveryType === "asset"
      ? t("product.deliveryAsset")
      : product.deliveryType === "license"
        ? t("product.deliveryLicense")
        : t("product.deliveryExternal");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "HealthApplication",
    description: product.description
      ? localize(product.description, l)
      : undefined,
    ...(product.priceMinor != null && !isQuote
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: fromMinor(product.priceMinor).toFixed(2),
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: nav("home"), url: `${localeBase}` },
          { name: nav("systems"), url: `${localeBase}/digihealth` },
          { name, url: `${localeBase}/digihealth/product/${slug}` },
        ])}
      />
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-8)" }}
      >
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: nav("systems"), href: "/digihealth" },
            { label: name },
          ]}
        />

        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "var(--s-10)",
            alignItems: "start",
          }}
        >
          {/* Screenshots */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
            }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "16 / 10",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                background: "var(--color-surface-2)",
              }}
            >
              {product.screenshots[0] ? (
                <ZoomImage
                  src={product.screenshots[0]}
                  alt={name}
                  sizes="(max-width: 980px) 100vw, 60vw"
                  priority
                />
              ) : (
                <Placeholder
                  label={name}
                  tone="slate"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
            {product.screenshots.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.screenshots.slice(1, 5).map((img, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      width: 96,
                      height: 60,
                      borderRadius: "var(--r-sm)",
                      overflow: "hidden",
                      background: "var(--color-surface-2)",
                    }}
                  >
                    <Image
                      src={img}
                      alt={`${name} ${i + 2}`}
                      fill
                      sizes="96px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info + CTA */}
          <aside
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-xl)",
              background: "var(--color-surface)",
              padding: "var(--s-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
              boxShadow: "var(--shadow-md)",
              position: "sticky",
              top: 96,
            }}
          >
            <h1
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {name}
            </h1>
            <div
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: "var(--color-brand-deep)",
              }}
            >
              {priceLabel}
            </div>
            <span
              style={{
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {deliveryNote}
            </span>

            {isQuote ? (
              <CtaButton href="#request">{t("buy.getQuote")}</CtaButton>
            ) : (
              <SoftwareBuyButton
                productId={String(product._id)}
                slug={product.slug}
                owned={owned}
              />
            )}

            {product.demoUrl && (
              <a
                href={product.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "var(--fs-body-sm)",
                  color: "var(--color-brand-deep)",
                  textAlign: "center",
                }}
              >
                {t("product.demo")} ↗
              </a>
            )}
          </aside>
        </div>

        {/* Overview */}
        {product.description && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
              maxWidth: 760,
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("product.overview")}
            </h2>
            <p
              style={{
                color: "var(--color-text)",
                lineHeight: "var(--lh-body)",
                whiteSpace: "pre-line",
              }}
            >
              {localize(product.description, l)}
            </p>
          </div>
        )}

        {/* Features */}
        {product.features.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
              maxWidth: 760,
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("product.features")}
            </h2>
            <ul style={{ display: "grid", gap: 8, paddingLeft: 18 }}>
              {product.features.map((f, i) => (
                <li key={i} style={{ color: "var(--color-text)" }}>
                  {localize(f, l)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quote request form */}
        {isQuote && (
          <div
            id="request"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
              maxWidth: 720,
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("buy.getQuote")}
            </h2>
            <InquiryForm
              linkedEntity={{ kind: "software", id: String(product._id) }}
              subject={name}
            />
          </div>
        )}
      </Container>

      {related.length > 0 && (
        <section
          style={{
            background: "var(--color-surface-2)",
            paddingBlock: "clamp(40px, 5vw, 72px)",
            marginTop: "clamp(40px, 5vw, 80px)",
          }}
        >
          <Container style={{ display: "grid", gap: "var(--s-5)" }}>
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("product.more")}
            </h2>
            <CardGrid columns={3}>
              {related.map((p) => (
                <SoftwareCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Container>
        </section>
      )}

      <Container style={{ paddingBlock: "clamp(32px, 4vw, 64px)" }}>
        <RecentlyViewed
          title={t("product.recentlyViewed")}
          current={{
            href: `/digihealth/product/${product.slug}`,
            name,
            image: product.screenshots[0],
            meta: priceLabel,
          }}
        />
      </Container>

      <style>{`
        @media (max-width: 820px) {
          .equal-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
