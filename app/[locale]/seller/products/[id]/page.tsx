import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { redirect, Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerProductByIdLean } from "@/lib/repositories/products.repo";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";
import { SellerProductForm } from "@/components/seller/seller-product-form";

export const dynamic = "force-dynamic";

export default async function EditSellerProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const sellerId = String(session!.seller._id);
  const p = await getSellerProductByIdLean(sellerId, id);
  if (!p) notFound();

  const categories = await listCategories("marketplace");

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/seller/products" style={backLink}>
          ← Back to products
        </Link>
        <h1 style={pageTitle}>Edit product</h1>
      </div>
      <SellerProductForm
        categories={categories.map((c) => ({
          id: String(c._id),
          name: localize(c.name, loc),
        }))}
        initial={{
          id: String(p._id),
          name: p.name,
          description: p.description,
          categoryId: String(p.categoryId),
          priceMajor: p.priceMinor != null ? p.priceMinor / 100 : "",
          stockQty: p.stockQty,
          lowStockThreshold: p.lowStockThreshold,
          images: p.images,
          specs: p.specs,
          status: p.status === "archived" ? "active" : p.status,
        }}
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
