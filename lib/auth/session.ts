import { cookies } from "next/headers";

export const COOKIE = {
  access: "access_token",
  refresh: "refresh_token",
} as const;

const ACCESS_MAX_AGE = 60 * 15; // 15m
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30d

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function setAuthCookies(access: string, refresh: string) {
  const store = await cookies();
  for (const c of authCookieSpecs(access, refresh)) {
    store.set(c.name, c.value, c.options);
  }
}

/**
 * The same cookie pairs as `setAuthCookies`, as plain specs — for handlers that
 * must attach auth cookies to a response they build themselves (e.g. the
 * redirect returned by /api/auth/renew).
 */
export function authCookieSpecs(access: string, refresh: string) {
  return [
    {
      name: COOKIE.access,
      value: access,
      options: { ...baseOptions(), maxAge: ACCESS_MAX_AGE },
    },
    {
      name: COOKIE.refresh,
      value: refresh,
      options: { ...baseOptions(), maxAge: REFRESH_MAX_AGE },
    },
  ] as const;
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(COOKIE.access);
  store.delete(COOKIE.refresh);
}

export async function getAccessTokenCookie(): Promise<string | null> {
  return (await cookies()).get(COOKIE.access)?.value ?? null;
}

export async function getRefreshTokenCookie(): Promise<string | null> {
  return (await cookies()).get(COOKIE.refresh)?.value ?? null;
}
