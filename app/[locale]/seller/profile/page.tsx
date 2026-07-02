import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { SellerProfileForm } from "@/components/seller/seller-profile-form";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const seller = session!.seller;

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={pageTitle}>Profile</h1>
        <p style={subtle}>
          Your store details and payout information. This is used to pay you
          out.
        </p>
      </div>
      <SellerProfileForm
        initial={{
          displayName: seller.displayName,
          bio: seller.bio ?? "",
          logo: seller.logo ?? "",
          bankDetails: seller.bankDetails ?? {},
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

const subtle: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
};
