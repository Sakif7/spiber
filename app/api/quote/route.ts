import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QuoteBody = {
  name?: string;
  email?: string;
  org?: string;
  phone?: string;
  message?: string;
  category?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as QuoteBody | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { name, email, org, phone, message, category } = body;
  if (!name || !email || !message || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }
  const db = await getDb();
  if (!db) return NextResponse.json({ ok: true, persisted: false });
  await db.collection("quotes").insertOne({
    name,
    email,
    org: org ?? "",
    phone: phone ?? "",
    category: category ?? "general",
    message,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true, persisted: true });
}
