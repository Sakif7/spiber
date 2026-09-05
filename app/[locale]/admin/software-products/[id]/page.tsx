import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  SoftwareProductForm,
  type SoftwareFormInitial,
} from "@/components/admin/software-product-form";
import { getSoftwareProductByIdLean } from "@/lib/repositories/software.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function EditSoftwareProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const p = await getSoftwareProductByIdLean(id).catch(() => null);
  if (!p) notFound();

  const initial: SoftwareFormInitial = {
    id: String(p._id),
    name: { en: p.name.en, bn: p.name.bn ?? "", ja: p.name.ja ?? "" },
    slug: p.slug,
    description: p.description
      ? {
          en: p.description.en ?? "",
          bn: p.description.bn ?? "",
          ja: p.description.ja ?? "",
        }
      : { en: "", bn: "", ja: "" },
    screenshots: p.screenshots,
    features: p.features.map((f) => ({
      en: f.en,
      bn: f.bn ?? "",
      ja: f.ja ?? "",
    })),
    pricingModel: p.pricingModel,
    priceMinor: p.priceMinor,
    demoUrl: p.demoUrl,
    deliveryType: p.deliveryType,
    assetKey: p.assetKey,
    externalApp: p.externalApp,
    affiliateRateBp: p.affiliate?.rateBp,
    status: p.status,
  };

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/software-products"
        backLabel="Software products"
        title="Edit software product"
      />
      <SoftwareProductForm initial={initial} />
    </div>
  );
}
