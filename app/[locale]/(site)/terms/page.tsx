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
  return namespaceMetadata(locale as Locale, "pages.terms", "/terms");
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProsePage locale={locale as Locale} namespace="pages.terms" />;
}
