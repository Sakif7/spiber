import { setRequestLocale } from "next-intl/server";
import { DivisionHub } from "@/components/ui/division-hub";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "hubs.consulting", "/consulting");
}

export default async function ConsultingHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DivisionHub locale={locale as Locale} division="consulting" />;
}
