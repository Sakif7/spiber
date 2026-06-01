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
  store.set(COOKIE.access, access, {
    ...baseOptions(),
    maxAge: ACCESS_MAX_AGE,
  });
  store.set(COOKIE.refresh, refresh, {
    ...baseOptions(),
    maxAge: REFRESH_MAX_AGE,
  });
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
