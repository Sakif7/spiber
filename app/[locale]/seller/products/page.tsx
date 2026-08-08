import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import Image from "next/image";
import { redirect, Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { listSellerProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";
import { CtaButton } from "@/components/ui/cta-button";
import { DeleteProductButton } from "@/components/seller/delete-product-button";

export const dynamic = "force-dynamic";

const APPROVAL: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending review", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Live", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
  // Live listing whose content edit is awaiting re-review (still selling).
  updating: {
    label: "Live · update in review",
    bg: "#e0f2fe",
    color: "#075985",
  },
};

export default async function SellerProductsPage({
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

  const sellerId = String(session!.seller._id);
  const { items } = await listSellerProducts(sellerId, { pageSize: 60 });

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={pageTitle}>Products</h1>
          <p style={subtle}>Manage the products you sell.</p>
        </div>
        <CtaButton href="/seller/products/new">Add product</CtaButton>
      </div>

      {items.length === 0 ? (
        <div style={emptyBox}>
          <p style={{ color: "var(--color-text-strong)", fontWeight: 600 }}>
            No products yet.
          </p>
          <p style={subtle}>
            Add your first product to start selling on the marketplace.
          </p>
          <div>
            <CtaButton href="/seller/products/new">Add product</CtaButton>
          </div>
        </div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Product</th>
                <th style={th}>Price</th>
                <th style={th}>Stock</th>
                <th style={th}>Status</th>
                <th style={th}>Approval</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const id = String(p._id);
                const stateKey =
                  p.approvalStatus === "approved" && p.pendingDraft
                    ? "updating"
                    : p.approvalStatus;
                const approval = APPROVAL[stateKey] ?? APPROVAL.pending;
                const showReason =
                  Boolean(p.rejectionReason) && !p.pendingDraft;
                return (
                  <tr key={id} style={tr}>
                    <td style={td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div style={thumb}>
                          {p.images?.[0] ? (
                            <Image
                              src={p.images[0]}
                              alt=""
                              fill
                              sizes="44px"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <span
                              style={{
                                color: "var(--color-text-muted)",
                                fontSize: 11,
                              }}
                            >
                              —
                            </span>
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <span style={nameCell}>{localize(p.name, loc)}</span>
                          <span
                            style={{
                              ...subtle,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {p.sku}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      {p.priceMinor != null
                        ? formatBDT(p.priceMinor, loc)
                        : "—"}
                    </td>
                    <td style={td}>{p.stockQty}</td>
                    <td style={td}>
                      <span style={statusPill}>{p.status}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span
                          style={{
                            ...badge,
                            background: approval.bg,
                            color: approval.color,
                          }}
                        >
                          {approval.label}
                        </span>
                        {showReason && (
                          <span
                            style={{
                              fontSize: "var(--fs-caption)",
                              color: "#991b1b",
                              maxWidth: 260,
                              lineHeight: 1.4,
                            }}
                          >
                            {p.approvalStatus === "approved"
                              ? "Update rejected: "
                              : "Reason: "}
                            {p.rejectionReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Link href={`/seller/products/${id}`} style={editLink}>
                          Edit
                        </Link>
                        <DeleteProductButton id={id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const pageTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h3)",
  color: "var(--color-text-strong)",
};

const subtle: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
};

const emptyBox: CSSProperties = {
  border: "1px dashed var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-8)",
  display: "grid",
  gap: 10,
  justifyItems: "start",
};

const tableWrap: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  overflowX: "auto",
};

const table: CSSProperties = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: "var(--fs-caption)",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tr: CSSProperties = {
  borderBottom: "1px solid var(--color-border)",
};

const td: CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  color: "var(--color-text)",
  verticalAlign: "middle",
};

const nameCell: CSSProperties = {
  color: "var(--color-text-strong)",
  fontWeight: 500,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 260,
};

const thumb: CSSProperties = {
  position: "relative",
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  display: "grid",
  placeItems: "center",
};

const statusPill: CSSProperties = {
  fontSize: "var(--fs-caption)",
  padding: "3px 10px",
  borderRadius: "var(--r-pill)",
  background: "var(--color-surface-2)",
  color: "var(--color-text-muted)",
  textTransform: "capitalize",
};

const badge: CSSProperties = {
  display: "inline-block",
  fontSize: "var(--fs-caption)",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: "var(--r-pill)",
  whiteSpace: "nowrap",
};

const editLink: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  color: "var(--color-brand-deep)",
  padding: "6px 12px",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  textDecoration: "none",
};
