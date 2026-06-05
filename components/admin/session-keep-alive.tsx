"use client";

import { useEffect } from "react";

/**
 * Keeps the admin session warm. The access-token cookie lives only 15 minutes
 * (lib/auth/session.ts), so an admin who steps away gets bounced to login on
 * their next click. This silently calls the DB-checked refresh endpoint
 * (/api/auth/refresh — validates tokenVersion + disabled) on mount, on an
 * interval shorter than the access TTL, and whenever the tab regains focus,
 * rotating tokens before they expire. Best-effort: a failed refresh is ignored
 * and the next navigation falls back to the normal login flow.
 */
const REFRESH_EVERY_MS = 10 * 60 * 1000; // 10m, < the 15m access-token TTL

export function SessionKeepAlive() {
  useEffect(() => {
    const refresh = () => {
      fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
    };
    // Renew immediately so a page loaded with a nearly-expired token gets a
    // full fresh window, then keep it warm.
    refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
