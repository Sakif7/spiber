import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { BannerDeleteButton } from "@/components/admin/banner-delete-button";
import { getBannerById } from "@/lib/repositories/banners.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const b = await getBannerById(id).catch(() => null);
  if (!b) notFound();

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "var(--s-2)" }}>
          <Link
            href="/admin/marketplace/banners"
            style={{
              fontSize: "var(--fs-small)",
              color: "var(--color-text-muted)",
            }}
          >
            ← Banners
          </Link>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-2xl)",
              color: "var(--color-text-strong)",
            }}
          >
            {localize(b.title, "en")}
          </h1>
        </div>
        <BannerDeleteButton id={String(b._id)} />
      </div>
      <BannerForm
        initial={{
          id: String(b._id),
          slot: b.slot,
          title: { en: b.title.en, bn: b.title.bn, ja: b.title.ja },
          subtitle: b.subtitle
            ? { en: b.subtitle.en, bn: b.subtitle.bn }
            : undefined,
          image: b.image,
          images: b.images,
          href: b.href,
          cta: b.cta ? { en: b.cta.en, bn: b.cta.bn } : undefined,
          position: b.position,
          active: b.active,
          startsAt: b.startsAt ? new Date(b.startsAt).toISOString() : null,
          endsAt: b.endsAt ? new Date(b.endsAt).toISOString() : null,
        }}
      />
    </div>
  );
}
