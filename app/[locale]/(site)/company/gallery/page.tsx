import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyTabs } from "@/components/layout/section-tabs";
import { ComingSoon } from "@/components/ui/coming-soon";
import { LiveSearch } from "@/components/ui/live-search";
import { Link } from "@/i18n/navigation";
import { listPublishedAlbums } from "@/lib/repositories/gallery.repo";
import { localize } from "@/lib/schemas/localized";
import { namespaceMetadata } from "@/lib/seo/metadata";
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
  return namespaceMetadata(
    locale as Locale,
    "pages.gallery",
    "/company/gallery",
  );
}

export default async function GalleryIndex({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "gallery" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const sp = await searchParams;
  const q = str(sp.q);
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof listPublishedAlbums>> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
    pages: 1,
  };
  try {
    result = await listPublishedAlbums({ search: q, page });
  } catch (e) {
    logger.warn("gallery index load failed", e);
  }

  const showEmpty = result.items.length === 0 && !q;

  return (
    <>
      <PageHeader
        eyebrow={nav("company")}
        title={t("hero.title")}
        description={t("hero.description")}
        image="/diverse-medical-team-cheering.jpeg"
        imageAlt={t("hero.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: t("hero.breadcrumb") },
        ]}
      />
      <CompanyTabs />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          {showEmpty ? (
            <ComingSoon
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--s-4)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-muted)",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  {t("albums", { count: result.total })}
                </p>
                <LiveSearch
                  placeholder={t("searchPlaceholder")}
                  ariaLabel={t("search")}
                  size="sm"
                  style={{ width: "min(320px, 100%)" }}
                />
              </div>

              {result.items.length === 0 ? (
                <p
                  style={{
                    padding: "var(--s-8)",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {t("empty.title")}
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "var(--s-5)",
                  }}
                >
                  {result.items.map((a) => {
                    const cover = a.coverImage || a.images?.[0]?.url;
                    return (
                      <Link
                        key={String(a._id)}
                        href={`/company/gallery/${a.slug}`}
                        className="gallery-album-card"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          borderRadius: "var(--r-xl)",
                          overflow: "hidden",
                          border: "1px solid var(--color-hairline)",
                          background: "var(--color-surface)",
                          boxShadow: "var(--shadow-xs)",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            aspectRatio: "16 / 11",
                            background: "var(--color-surface-2)",
                          }}
                        >
                          {cover && (
                            <Image
                              src={cover}
                              alt={localize(a.title, l)}
                              fill
                              sizes="(max-width: 700px) 100vw, 360px"
                              style={{ objectFit: "cover" }}
                            />
                          )}
                          <div
                            aria-hidden
                            style={{
                              position: "absolute",
                              inset: 0,
                              background:
                                "linear-gradient(180deg, transparent 55%, rgba(6,37,39,0.5))",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              padding: "4px 10px",
                              borderRadius: "var(--r-pill)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "#fff",
                              background: "rgba(7,23,33,0.5)",
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            {t("photos", { count: a.images?.length ?? 0 })}
                          </span>
                        </div>
                        <div style={{ padding: "16px 18px 20px" }}>
                          <h3
                            style={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 600,
                              fontSize: 17,
                              letterSpacing: "-.01em",
                              color: "var(--color-text-strong)",
                              margin: "0 0 4px",
                            }}
                          >
                            {localize(a.title, l)}
                          </h3>
                          {a.date && (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {new Date(a.date).toLocaleDateString(l, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {result.pages > 1 && (
                <div
                  style={{ display: "flex", gap: 8, justifyContent: "center" }}
                >
                  {Array.from({ length: result.pages }).map((_, i) => {
                    const n = i + 1;
                    const params2 = new URLSearchParams();
                    if (q) params2.set("q", q);
                    if (n > 1) params2.set("page", String(n));
                    const qs = params2.toString();
                    return (
                      <Link
                        key={n}
                        href={`/company/gallery${qs ? `?${qs}` : ""}`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--color-border)",
                          background:
                            n === result.page
                              ? "var(--color-brand)"
                              : "var(--color-surface)",
                          color:
                            n === result.page
                              ? "#fff"
                              : "var(--color-text-muted)",
                          fontWeight: 600,
                          fontSize: "var(--fs-sm)",
                        }}
                      >
                        {n}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Container>
      </section>
      <style>{`
        .gallery-album-card { transition: transform 320ms cubic-bezier(.16,1,.3,1), box-shadow 320ms cubic-bezier(.16,1,.3,1), border-color 320ms; }
        .gallery-album-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--teal-300); }
        .gallery-album-card img { transition: transform 600ms cubic-bezier(.16,1,.3,1); }
        .gallery-album-card:hover img { transform: scale(1.04); }
        @media (prefers-reduced-motion: reduce) {
          .gallery-album-card, .gallery-album-card img { transition: none; }
          .gallery-album-card:hover { transform: none; }
          .gallery-album-card:hover img { transform: none; }
        }
      `}</style>
    </>
  );
}
