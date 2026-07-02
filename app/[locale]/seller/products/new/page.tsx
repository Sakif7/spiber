import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect, Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";
import { SellerProductForm } from "@/components/seller/seller-product-form";

export const dynamic = "force-dynamic";

export default async function NewSellerProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const categories = await listCategories("marketplace");

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/seller/products" style={backLink}>
          ← Back to products
        </Link>
        <h1 style={pageTitle}>New product</h1>
      </div>
      <SellerProductForm
        categories={categories.map((c) => ({
          id: String(c._id),
          name: localize(c.name, loc),
        }))}
      />
    </div>
  );
}

const pageTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h3)",
  color: "var(--color-text-strong)",
};

const backLink: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
  textDecoration: "none",
};
