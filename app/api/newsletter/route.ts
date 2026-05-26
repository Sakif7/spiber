import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  await db.collection("newsletter").updateOne(
    { email },
    { $setOnInsert: { email, createdAt: new Date() } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, persisted: true });
}
