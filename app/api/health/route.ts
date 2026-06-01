import { NextResponse } from "next/server";

// Always evaluated fresh — this is the container liveness probe for Coolify.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
