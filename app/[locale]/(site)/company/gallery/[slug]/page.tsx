import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { GalleryLightbox } from "@/components/company/gallery/lightbox";
import { getPublishedAlbumBySlug } from "@/lib/repositories/gallery.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const album = await getPublishedAlbumBySlug(slug).catch(() => null);
  const l = locale as Locale;
  if (!album) {
    return pageMetadata({
      locale: l,
      path: `/company/gallery/${slug}`,
      title: "Gallery",
    });
  }
  return pageMetadata({
    locale: l,
    path: `/company/gallery/${slug}`,
    title: localize(album.title, l),
    description: album.description ? localize(album.description, l) : undefined,
  });
}

export default async function AlbumDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "gallery" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const album = await getPublishedAlbumBySlug(slug).catch(() => null);
  if (!album) notFound();

  const cover =
    album.coverImage ||
    album.images?.[0]?.url ||
    "/diverse-medical-team-cheering.jpeg";
  const images = (album.images ?? []).map((im) => ({
    url: im.url,
    caption: im.caption ? localize(im.caption, l) : undefined,
  }));

  return (
    <>
      <PageHeader
        eyebrow={
          album.date
            ? new Date(album.date).toLocaleDateString(l, {
                year: "numeric",
                month: "long",
              })
            : nav("company")
        }
        title={localize(album.title, l)}
        description={
          album.description ? localize(album.description, l) : undefined
        }
        image={cover}
        imageAlt={localize(album.title, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hero.breadcrumb"), href: "/company/gallery" },
          { label: localize(album.title, l) },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          <Link
            href="/company/gallery"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-brand-deep)",
              width: "fit-content",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("back")}
          </Link>

          {images.length === 0 ? (
            <p
              style={{
                padding: "var(--s-8)",
                textAlign: "center",
                color: "var(--color-text-muted)",
              }}
            >
              {t("albumEmpty.description")}
            </p>
          ) : (
            <GalleryLightbox
              images={images}
              labels={{
                close: t("close"),
                prev: t("prev"),
                next: t("next"),
              }}
            />
          )}
        </Container>
      </section>
    </>
  );
}
