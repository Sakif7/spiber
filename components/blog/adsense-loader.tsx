"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SCRIPT = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
/** Slots already handed to Google, so a remount never asks twice for one. */
const queued = new WeakSet<Element>();

/**
 * Loads Google's ad script once the page is idle — after the article has
 * painted and hydrated, never in its way — and asks it to fill each new
 * in-article slot. Mount it keyed by the post, so moving from one post to
 * the next fills the new post's slots.
 *
 * Injected by hand rather than through `next/script`: Google's tag logs an
 * error for the `data-nscript` attribute that one adds.
 */
export function AdsenseLoader({ client }: { client: string }) {
  useEffect(() => {
    const fill = () => {
      const slots = Array.from(
        document.querySelectorAll(
          ".ad-slot ins.adsbygoogle:not([data-adsbygoogle-status])",
        ),
      ).filter((el) => !queued.has(el));
      if (slots.length === 0) return;
      if (!document.querySelector(`script[src^="${SCRIPT}"]`)) {
        const script = document.createElement("script");
        script.async = true;
        script.src = `${SCRIPT}?client=${encodeURIComponent(client)}`;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
      // Google's queue: each push fills the next empty slot, in page order.
      const queue = (window.adsbygoogle = window.adsbygoogle || []);
      for (const el of slots) {
        queued.add(el);
        queue.push({});
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(fill, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(fill, 1500);
    return () => window.clearTimeout(id);
  }, [client]);

  return null;
}
