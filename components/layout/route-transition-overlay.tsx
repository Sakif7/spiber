"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Global navigation feedback for the public storefront.
 *
 * App Router keeps the current page mounted while the next route renders on
 * the server, so without a cue the user clicks and nothing visibly happens.
 * This overlay watches same-origin link clicks, then blurs the page behind a
 * brand spinner until the route commits (detected via pathname/search change).
 *
 * Programmatic navigations (router.push) don't emit a click, so call
 * `startRouteOverlay()` right before them to opt in (see components/shop/filters).
 *
 * Admin uses route-level `loading.tsx` skeletons instead, so this is mounted
 * only inside the public (site) layout.
 */

// Don't flash the overlay for instant navigations.
const SHOW_DELAY_MS = 140;
// Safety net so a swallowed navigation can never leave the veil stuck on.
const SAFETY_MS = 6000;
// Custom event programmatic navigations dispatch to show the overlay.
const START_EVENT = "spiber:route-overlay-start";

/** Show the overlay before a programmatic navigation (router.push/replace). */
export function startRouteOverlay() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(START_EVENT));
  }
}

// `useSearchParams` forces a Suspense boundary on statically-generated pages
// (the home page is one), so wrap the implementation.
export function RouteTransitionOverlay() {
  return (
    <Suspense fallback={null}>
      <RouteTransitionOverlayInner />
    </Suspense>
  );
}

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function RouteTransitionOverlayInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True from arming a navigation until the route commits (or the safety net
  // fires). The show-timer checks this so an instant load can't strand the veil.
  const armed = useRef(false);

  function clearTimers() {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    showTimer.current = null;
    safetyTimer.current = null;
  }

  // Hide the moment the route commits. React's documented "adjust state when a
  // tracked value changes" pattern (store the previous value in state, compare
  // during render) — cleaner and lint-safe versus a setState-in-effect.
  const navKey = `${pathname}?${searchParams.toString()}`;
  const [lastNavKey, setLastNavKey] = useState(navKey);
  if (lastNavKey !== navKey) {
    setLastNavKey(navKey);
    // Disarm synchronously at the commit render so a show-timer that fires
    // afterwards is a no-op — an effect-based disarm can lose that race and
    // strand the veil. The write is idempotent and paired with the setState
    // above; a discarded speculative render would at worst hide the veil one
    // frame early, never strand it. (Hence the scoped ref-in-render allowance.)
    // eslint-disable-next-line react-hooks/refs -- intentional synchronous disarm at commit
    armed.current = false;
    setVisible(false);
  }

  // Cancel any pending show/safety timers once the route has changed.
  useEffect(() => {
    clearTimers();
  }, [navKey]);

  useEffect(() => {
    function begin() {
      clearTimers();
      armed.current = true;
      showTimer.current = setTimeout(() => {
        // Only reveal while the navigation is still in flight. If the route has
        // already committed (instant load), `armed` is false and we skip — so
        // the veil can never strand on top of a page that already rendered.
        if (armed.current) setVisible(true);
      }, SHOW_DELAY_MS);
      safetyTimer.current = setTimeout(() => {
        armed.current = false;
        setVisible(false);
      }, SAFETY_MS);
    }

    function onClick(event: MouseEvent) {
      // Ignore modified clicks / non-primary buttons (new tab, etc.).
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const link = anchor as HTMLAnchorElement;

      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const rel = link.getAttribute("rel");
      if (rel && rel.includes("external")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.protocol !== "http:" && url.protocol !== "https:") return;

      // Same destination → no navigation will happen.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      // This capture-phase listener runs before React's bubble-phase onClick,
      // so defaultPrevented isn't set yet for React-cancelled links. Defer the
      // decision to a microtask (after the full dispatch) and re-check, so a
      // link that opens a modal / cancels nav never strands the veil on screen.
      queueMicrotask(() => {
        if (!event.defaultPrevented) begin();
      });
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, begin);
      clearTimers();
    };
  }, []);

  return (
    <>
      {/* Persistent live region: announcing requires the region to pre-exist in
          the DOM, so keep it mounted and only toggle its text. */}
      <div role="status" aria-live="polite" style={srOnly}>
        {visible ? t("loading") : ""}
      </div>
      {visible && (
        <div className="route-overlay" aria-hidden>
          <div className="route-overlay__chip">
            <span className="route-spinner" />
          </div>
        </div>
      )}
    </>
  );
}
