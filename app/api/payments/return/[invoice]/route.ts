import { NextResponse } from "next/server";
import { returnDestination } from "@/lib/services/payment.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * Where the gateway sends the customer back (PayStation's `callback_url`).
 *
 * Coming back is navigation, not proof: PayStation appends
 * `?status=Successful|Failed|Canceled`, which only words the page when the
 * money did not arrive. Whether it did is asked of PayStation before the
 * customer is redirected to their order, so the page they land on is already
 * the truth.
 */
async function handle(
  req: Request,
  { params }: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await params;
  const url = new URL(req.url);
  // The public origin, never the request's: behind the proxy a route can see
  // the container's own address, and the customer must land on the site.
  const target = (path: string) =>
    NextResponse.redirect(new URL(path, siteConfig.url), 303);

  if (!rateLimit(`payment-return:${clientIp(req)}`, 30, 60_000).ok) {
    return target("/");
  }
  let said = url.searchParams.get("status");
  if (!said && req.method === "POST") {
    const form = await req.formData().catch(() => null);
    const v = form?.get("status");
    said = typeof v === "string" ? v : null;
  }
  const invoiceNumber = decodeURIComponent(invoice).slice(0, 80);
  return target(await returnDestination(invoiceNumber, said));
}

export const GET = handle;
// Some gateways post the customer back; answer that the same way.
export const POST = handle;
