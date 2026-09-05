import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BannerForm } from "@/components/admin/banner-form";
import { BannerDeleteButton } from "@/components/admin/banner-delete-button";
import { getBannerById } from "@/lib/repositories/banners.repo";
import { localize } from "@/lib/schemas/localized";
import { EditorHeader } from "@/components/admin/ui/form-shell";

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
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/marketplace/banners"
        backLabel="Banners"
        title={localize(b.title, "en")}
        action={<BannerDeleteButton id={String(b._id)} />}
      />
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
