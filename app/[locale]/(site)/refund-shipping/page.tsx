import { setRequestLocale } from "next-intl/server";
import { ProsePage } from "@/components/ui/prose-page";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(
    locale as Locale,
    "pages.refundShipping",
    "/refund-shipping",
  );
}

export default async function RefundShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProsePage locale={locale as Locale} namespace="pages.refundShipping" />
  );
}
