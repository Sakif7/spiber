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

  // Prefill CONTENT from the pending draft when one exists — the seller edits
  // their latest submitted intent, not the (older) live version behind it.
  const draft = p.approvalStatus === "approved" ? p.pendingDraft : null;
  const isLive = p.approvalStatus === "approved";

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/seller/products" style={backLink}>
          ← Back to products
        </Link>
        <h1 style={pageTitle}>Edit product</h1>
      </div>

      {draft && (
        <p style={{ ...notice, background: "#e0f2fe", color: "#075985" }}>
          This listing has a content update awaiting review — you are editing
          that update. The approved version stays live until it is approved.
        </p>
      )}
      {p.rejectionReason && !draft && (
        <p style={{ ...notice, background: "#fee2e2", color: "#991b1b" }}>
          {isLive
            ? "Your last update was not approved: "
            : "This listing was not approved: "}
          {p.rejectionReason}
          {" — revise and save to resubmit."}
        </p>
      )}
      {isLive && (
        <p style={notice}>
          Price, stock and visibility changes apply immediately. Changes to the
          name, description, category, images or specifications go for a quick
          review first — your live listing keeps selling in the meantime.
        </p>
      )}

      <SellerProductForm
        categories={categories.map((c) => ({
          id: String(c._id),
          name: localize(c.name, loc),
        }))}
        initial={{
          id: String(p._id),
          name: draft?.name ?? p.name,
          description: draft?.description ?? p.description,
          categoryId: String(draft?.categoryId ?? p.categoryId),
          priceMajor: p.priceMinor != null ? p.priceMinor / 100 : "",
          stockQty: p.stockQty,
          lowStockThreshold: p.lowStockThreshold,
          images: draft?.images ?? p.images,
          specs: draft?.specs ?? p.specs,
          status: p.status === "archived" ? "active" : p.status,
        }}
      />
    </div>
  );
}

const notice: CSSProperties = {
  fontSize: "var(--fs-small)",
  color: "var(--color-text-muted)",
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  padding: "10px 14px",
  margin: 0,
  lineHeight: 1.5,
};

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
