import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/schemas/user";
import { logger } from "@/lib/log";

/**
 * JWT signing/verification with `jose` (works on the Node.js proxy runtime and
 * in route handlers). Access/verify/reset tokens are signed with JWT_SECRET;
 * refresh tokens with JWT_REFRESH_SECRET.
 *
 * A `purpose` claim distinguishes token kinds so an access token can't be
 * replayed as a refresh/verify/reset token.
 */

type Purpose = "access" | "refresh" | "verify" | "reset";

function secretFor(purpose: Purpose): Uint8Array {
  const useRefresh = purpose === "refresh";
  const env = useRefresh
    ? process.env.JWT_REFRESH_SECRET
    : process.env.JWT_SECRET;
  if (env) return new TextEncoder().encode(env);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${useRefresh ? "JWT_REFRESH_SECRET" : "JWT_SECRET"} is not configured`,
    );
  }
  logger.warn(`Using insecure dev fallback secret for "${purpose}" tokens`);
  return new TextEncoder().encode(
    `dev-insecure-${useRefresh ? "refresh" : "access"}-secret`,
  );
}

const EXPIRY: Record<Purpose, string> = {
  access: "15m",
  refresh: "30d",
  verify: "24h",
  reset: "1h",
};

export type AccessClaims = { sub: string; email: string; roles: Role[] };

async function sign(
  purpose: Purpose,
  sub: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  return new SignJWT({ ...extra, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRY[purpose])
    .sign(secretFor(purpose));
}

export function signAccessToken(claims: AccessClaims): Promise<string> {
  return sign("access", claims.sub, {
    email: claims.email,
    roles: claims.roles,
  });
}
/** Refresh + reset tokens carry the user's tokenVersion (`tv`) so they can be revoked. */
export type PurposeClaims = { sub: string; tokenVersion: number };

export function signRefreshToken(
  sub: string,
  tokenVersion = 0,
): Promise<string> {
  return sign("refresh", sub, { tv: tokenVersion });
}
export function signVerifyToken(sub: string): Promise<string> {
  return sign("verify", sub);
}
export function signResetToken(sub: string, tokenVersion = 0): Promise<string> {
  return sign("reset", sub, { tv: tokenVersion });
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretFor("access"));
    if (payload.purpose !== "access") return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      roles: Array.isArray(payload.roles) ? (payload.roles as Role[]) : [],
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<PurposeClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretFor("refresh"));
    if (payload.purpose !== "refresh") return null;
    return { sub: String(payload.sub), tokenVersion: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

/** Verify a single-purpose token (verify/reset); returns the subject + tokenVersion. */
export async function verifyPurposeToken(
  token: string,
  purpose: "verify" | "reset",
): Promise<PurposeClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretFor(purpose));
    if (payload.purpose !== purpose) return null;
    return { sub: String(payload.sub), tokenVersion: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}
