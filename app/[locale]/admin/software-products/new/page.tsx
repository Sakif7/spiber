import { setRequestLocale } from "next-intl/server";
import { SoftwareProductForm } from "@/components/admin/software-product-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewSoftwareProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/software-products"
        backLabel="Software products"
        title="New software product"
      />
      <SoftwareProductForm />
    </div>
  );
}
