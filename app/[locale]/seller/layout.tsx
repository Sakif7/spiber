import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { SellerShell } from "@/components/seller/seller-shell";

export const dynamic = "force-dynamic";

export default async function SellerLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  return (
    <SellerShell sellerName={session!.seller.displayName}>
      {children}
    </SellerShell>
  );
}
