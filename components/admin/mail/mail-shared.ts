import { useSyncExternalStore } from "react";
import type { MailAddress } from "@/lib/mail/store/types";

/** Plumbing the three mail panes share: API helper, formatting, breakpoints. */

type Json<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export async function mailApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as Json<T> | null;
  if (!res.ok || !json?.ok || json.data === undefined) {
    const code = json?.error?.code ?? `http_${res.status}`;
    throw new Error(
      code === "mail_not_configured"
        ? "The mail server is not configured on this deployment."
        : code === "mail_auth_failed"
          ? "The mail server refused the app's master login."
          : code === "mail_unavailable"
            ? "The mail server could not be reached."
            : code === "no_folder"
              ? "This mailbox has no such folder."
              : code === "transport_not_configured"
                ? "Sending is not configured on this deployment yet."
                : code === "transport_failed"
                  ? "The mail server refused the message. Nothing was sent."
                  : json?.error?.message || code,
    );
  }
  return json.data;
}

export const enc = encodeURIComponent;

export const personLabel = (a: MailAddress | null) =>
  a ? a.name || a.address : "—";

export const personFull = (a: MailAddress) =>
  a.name ? `${a.name} <${a.address}>` : a.address;

/** Up to two initials for the avatar fallback ("William Smith" → "WS"). */
export function initials(a: MailAddress | null): string {
  const words = personLabel(a)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join("") || "?";
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "yesterday", "about 2 months ago" — the list's date. */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(sec / 86_400), "day");
  if (abs < 86_400 * 365) {
    return `about ${rtf.format(Math.round(sec / (86_400 * 30)), "month")}`;
  }
  const years = sec / (86_400 * 365);
  const whole = Math.round(years);
  const frac = Math.abs(years) - Math.floor(Math.abs(years));
  const qualifier = frac > 0.75 ? "almost " : frac < 0.25 ? "" : "over ";
  const base = whole === 0 ? Math.sign(sec) || -1 : whole;
  return `${qualifier}${rtf.format(base, "year")}`;
}

/** "Oct 22, 2023, 9:00:00 AM" — the reader's date. */
export const fullDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "";

export const humanSize = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`;

const DESKTOP = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** `lg` and up shows the three resizable panes; below, one pane at a time. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}
