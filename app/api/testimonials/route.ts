import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const revalidate = 60;

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ testimonials: [] });
  const testimonials = await db
    .collection("testimonials")
    .find({}, { projection: { _id: 0 } })
    .sort({ order: 1 })
    .limit(20)
    .toArray();
  return NextResponse.json({ testimonials });
}
