"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

/**
 * Self-contained admin theme provider (replaces next-themes to avoid its
 * client-rendered <script>, which React 19 / Turbopack flags). Toggles a
 * `.dark` class on <html> based on a stored preference. The pre-paint no-flash
 * script lives in the admin server layout. Mounted ONLY in the admin layout,
 * so the public site never gets dark mode (and the `(site)` layout strips any
 * lingering class on client-nav).
 */
type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

export const ADMIN_THEME_KEY = "spiber-admin-theme";
const CHANGE_EVENT = "spiber-admin-theme-change";

type Ctx = {
  theme: Resolved;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
};
const ThemeContext = createContext<Ctx | null>(null);

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(ADMIN_THEME_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}
function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
function resolve(pref: ThemePref): Resolved {
  return pref === "system" ? (prefersDark() ? "dark" : "light") : pref;
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", cb);
  };
}

export function AdminThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pref = useSyncExternalStore(
    subscribe,
    readPref,
    () => "system" as ThemePref,
  );
  const theme = useSyncExternalStore(
    subscribe,
    () => resolve(readPref()),
    () => "light" as Resolved,
  );

  // Apply the resolved theme to <html> (a DOM side-effect, not React state).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function setPref(next: ThemePref) {
    localStorage.setItem(ADMIN_THEME_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <ThemeContext.Provider value={{ theme, pref, setPref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAdminTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return ctx;
}
