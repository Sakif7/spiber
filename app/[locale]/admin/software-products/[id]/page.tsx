import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  SoftwareProductForm,
  type SoftwareFormInitial,
} from "@/components/admin/software-product-form";
import { getSoftwareProductByIdLean } from "@/lib/repositories/software.repo";

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
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Edit software product
      </h1>
      <SoftwareProductForm initial={initial} />
    </div>
  );
}
