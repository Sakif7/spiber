import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/services/auth.service";

// Email links are GET requests; verify the token, then redirect to login.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const locale = url.searchParams.get("locale") === "bn" ? "bn" : "en";

  const result = await verifyEmail(token);

  const dest = new URL(`/${locale}/login`, url.origin);
  if (result.ok) dest.searchParams.set("verified", "1");
  else dest.searchParams.set("error", "verify");
  return NextResponse.redirect(dest);
}
