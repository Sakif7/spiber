import { setRequestLocale } from "next-intl/server";
import { SoftwareProductForm } from "@/components/admin/software-product-form";

export const dynamic = "force-dynamic";

export default async function NewSoftwareProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
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
        New software product
      </h1>
      <SoftwareProductForm />
    </div>
  );
}
