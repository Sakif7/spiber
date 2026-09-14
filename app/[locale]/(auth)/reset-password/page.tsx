import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/**
 * The old standalone reset page. Password links now open the sign-in modal
 * on the home page (same look as the rest of the site); this keeps the
 * links already in people's inboxes working. Robots: `/reset-password`
 * stays in the private paths.
 */
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
  const qs = new URLSearchParams({ auth: "reset" });
  if (typeof sp.token === "string" && sp.token) qs.set("token", sp.token);
  if (sp.invite === "1") qs.set("invite", "1");
  redirect(`/${locale}?${qs.toString()}`);
}
