/**
 * Same-origin enforcement for state-changing requests (CSRF defence).
 *
 * Until now the only thing standing between a hostile page and an admin action
 * was the auth cookie's `SameSite=Lax`. That does block a cross-site POST from
 * carrying the session, but it is a single control with known soft edges: it
 * does not cover top-level GET navigations, browsers have historically shipped
 * different defaults, and a `multipart/form-data` POST (which is what the vault
 * upload is) is a "simple request" that never triggers a CORS preflight — so
 * nothing else would stop it either.
 *
 * This adds a second, independent check using the Fetch Metadata headers that
 * every current browser sends and that a page cannot forge:
 *
 *   Sec-Fetch-Site: same-origin | same-site | cross-site | none
 *
 * `none` means the user typed the URL or used a bookmark; `same-origin` is our
 * own UI. Anything else is another site driving the request, which no admin
 * mutation should ever be.
 *
 * Non-browser callers (a cron scheduler, a payment gateway webhook, curl) send
 * neither `Sec-Fetch-Site` nor `Origin`. Those are allowed through here — they
 * carry no ambient cookie authority, so they are not a CSRF vector, and they
 * authenticate by their own means (a bearer secret, a signature).
 */

/** Requests that cannot change state, so CSRF does not apply. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Is this request coming from our own origin (or a non-browser client)?
 *
 * Checks `Sec-Fetch-Site` first, then falls back to comparing `Origin` against
 * the request's own host for older clients that send one but not the other.
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = req.headers.get("origin");
  if (!origin) return true; // Not a browser: no ambient cookie to abuse.

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // Malformed Origin — treat as hostile.
  }

  // Compare against the host the request actually arrived on, falling back to
  // the configured app URL (behind a proxy, `Host` is the public hostname).
  const candidates = new Set<string>();
  const host = req.headers.get("host");
  if (host) candidates.add(host);
  try {
    candidates.add(new URL(req.url).host);
  } catch {
    /* url is always absolute in route handlers; ignore */
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      candidates.add(new URL(appUrl).host);
    } catch {
      /* misconfigured APP_URL should not crash the check */
    }
  }
  return candidates.has(originHost);
}

/**
 * True when the request must be refused: it changes state and did not come
 * from us. Callers respond 403.
 */
export function isCrossSiteMutation(req: Request): boolean {
  return !isSafeMethod(req.method) && !isSameOrigin(req);
}

/**
 * Is this GET a browser sub-resource load (`<img>`, `<script>`, `<iframe>`)
 * rather than a navigation or a fetch?
 *
 * Used by the few GET endpoints that legitimately change state (silent token
 * renewal sits in a redirect chain, so it cannot become a POST): a page cannot
 * drive them through an image tag, but a real navigation still works.
 */
export function isPassiveSubresource(req: Request): boolean {
  const dest = req.headers.get("sec-fetch-dest");
  if (!dest) return false;
  return dest !== "document" && dest !== "empty";
}
