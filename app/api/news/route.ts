import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const revalidate = 60;

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ posts: [] });
  const posts = await db
    .collection("posts")
    .find({}, { projection: { _id: 0 } })
    .sort({ date: -1 })
    .limit(6)
    .toArray();
  return NextResponse.json({ posts });
}
