import { NextResponse } from "next/server";
import { parseJson } from "@/lib/http/validate";
import { contactInputSchema } from "@/lib/schemas/forms";
import { submitQuote } from "@/lib/services/leads.service";

export async function POST(req: Request) {
  const parsed = await parseJson(req, contactInputSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }
  const { persisted } = await submitQuote(parsed.data);
  return NextResponse.json({ ok: true, persisted });
}
