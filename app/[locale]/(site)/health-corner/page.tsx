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
  return namespaceMetadata(
    locale as Locale,
    "hubs.health-corner",
    "/health-corner",
  );
}

export default async function HealthCornerHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DivisionHub locale={locale as Locale} division="health-corner" />;
}
