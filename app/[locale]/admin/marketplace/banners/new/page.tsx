import { setRequestLocale } from "next-intl/server";
import { BannerForm } from "@/components/admin/banner-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewBannerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/marketplace/banners"
        backLabel="Banners"
        title="New banner"
      />
      <BannerForm />
    </div>
  );
}
