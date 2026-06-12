"use client";

import { useEffect } from "react";

/**
 * The admin area toggles a `.dark` class on <html> (via AdminThemeProvider).
 * When a
 * user navigates from a dark admin page back to the public site within the
 * same SPA session, that class can linger. The public marketing site is
 * always light, so strip it on mount. (Fresh public loads never set it — the
 * admin ThemeProvider isn't mounted here.)
 */
export function LightModeGuard() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return null;
}
