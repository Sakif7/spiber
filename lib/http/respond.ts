import { NextResponse } from "next/server";

/**
 * Standard JSON response envelope for NEW API endpoints (auth, admin, …):
 *   success → { ok: true, data }
 *   failure → { ok: false, error: { code, message?, details? } }
 *
 * Note: the four legacy landing routes (testimonials/news/newsletter/quote)
 * keep their original bespoke shapes for frontend compatibility.
 */

export type ApiError = {
  code: string;
  message?: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(error: ApiError, status = 400) {
  return NextResponse.json({ ok: false as const, error }, { status });
}
