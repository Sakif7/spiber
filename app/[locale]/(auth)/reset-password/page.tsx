import { setRequestLocale, getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "auth.reset", "/reset-password");
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  // A new employee's invite lands on the same form with different words.
  const invite = sp.invite === "1";
  const t = await getTranslations({ locale, namespace: "auth.reset" });

  return (
    <>
      <header style={{ marginBottom: "var(--s-5)" }}>
        <h1
          style={{
            fontSize: "var(--fs-h3)",
            color: "var(--color-text-strong)",
          }}
        >
          {invite ? t("inviteTitle") : t("title")}
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {invite ? t("inviteDescription") : t("description")}
        </p>
      </header>
      <ResetPasswordForm token={token} invite={invite} />
    </>
  );
}
