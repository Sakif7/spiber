import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/services/auth.service";
import { asLocale } from "@/lib/i18n/intl-locale";

// Email links are GET requests; verify the token, then redirect to login.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const locale = asLocale(url.searchParams.get("locale"));

  const result = await verifyEmail(token);

  // /login is gone; open the auth modal on the homepage instead.
  const dest = new URL(`/${locale}`, url.origin);
  dest.searchParams.set("auth", "login");
  if (result.ok) dest.searchParams.set("verified", "1");
  else dest.searchParams.set("error", "verify");
  return NextResponse.redirect(dest);
}
