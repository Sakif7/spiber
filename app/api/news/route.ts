import { NextResponse } from "next/server";
import { getLatestPosts } from "@/lib/services/landing.service";

export const revalidate = 60;

export async function GET() {
  const posts = await getLatestPosts(6);
  return NextResponse.json({ posts });
}
