import { NextResponse } from "next/server";
import { parseJson } from "@/lib/http/validate";
import { newsletterInputSchema } from "@/lib/schemas/forms";
import { subscribeToNewsletter } from "@/lib/services/leads.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const parsed = await parseJson(req, newsletterInputSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const { persisted } = await subscribeToNewsletter(parsed.data);
  return NextResponse.json({ ok: true, persisted });
}
