"use client";

import { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

export type RecentItem = {
  href: string;
  name: string;
  image?: string;
  meta?: string;
};

const KEY = "spiber:recently-viewed";
const MAX = 12;
const SHOW = 4;

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * Records the current item in localStorage and shows previously-viewed ones
 * (cross-division, most-recent first). Uses useSyncExternalStore so it reads the
 * client-only store without a hydration mismatch; the write happens in an effect
 * (same-tab setItem doesn't fire `storage`, so the displayed snapshot stays the
 * pre-visit list — i.e. excludes the current item by construction).
 */
export function RecentlyViewed({
  current,
  title,
}: {
  current: RecentItem;
  title: string;
}) {
  const { href, name, image, meta } = current;

  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY),
    () => null,
  );

  useEffect(() => {
    let stored: RecentItem[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      stored = [];
    }
    const others = stored.filter((i) => i && i.href !== href);
    const next = [{ href, name, image, meta }, ...others].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — skip */
    }
  }, [href, name, image, meta]);

  if (raw == null) return null; // server / pre-hydration
  let parsed: RecentItem[] = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const items = parsed.filter((i) => i && i.href !== href).slice(0, SHOW);
  if (items.length === 0) return null;

  return (
    <section style={{ display: "grid", gap: "var(--s-5)" }}>
      <h2
        style={{
          fontSize: "var(--fs-h4)",
          color: "var(--color-text-strong)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <div
        className="equal-4col"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block h-full">
            <CardContainer
              containerClassName="py-0 w-full h-full"
              className="h-full w-full"
            >
              <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow duration-300 hover:shadow-[0_18px_44px_-18px_var(--glow-brand)]">
                <CardItem translateZ="60" className="w-full">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
                    {it.image ? (
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 22vw"
                        className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--teal-100), var(--teal-200))",
                        }}
                      />
                    )}
                  </div>
                </CardItem>
                <CardItem
                  as="h3"
                  translateZ="40"
                  className="mt-3 line-clamp-2 w-full text-[14px] leading-snug font-semibold text-[var(--color-text-strong)]"
                >
                  {it.name}
                </CardItem>
                {it.meta && (
                  <CardItem
                    translateZ="30"
                    className="mt-1 w-full text-[length:var(--fs-caption)] font-semibold text-[color:var(--color-brand-deep)]"
                  >
                    {it.meta}
                  </CardItem>
                )}
              </CardBody>
            </CardContainer>
          </Link>
        ))}
      </div>
    </section>
  );
}
