/**
 * In-memory fixed-window rate limiter. Sufficient for a single Coolify
 * instance in Phase 0; swap for a Redis/Upstash store when scaling out
 * (tracked as a follow-up). Keyed by e.g. `${ip}:${route}`.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  // Prefer x-real-ip: a trusted reverse proxy (Coolify/Traefik) overwrites it
  // with the real peer, so a client can't forge it to dodge per-IP limits. Only
  // fall back to the (client-spoofable) left-most X-Forwarded-For when no proxy
  // header is present, e.g. local dev. Ensure the proxy strips inbound x-real-ip.
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}
