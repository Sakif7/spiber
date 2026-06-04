"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { localize, type Localized } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export type HeroBanner = {
  id: string;
  title: Localized;
  subtitle?: Localized;
  image?: string;
  href?: string;
  cta?: Localized;
};

/** Auto-rotating hero (transform/opacity only; respects reduced motion). */
export function BannerCarousel({
  banners,
  locale,
}: {
  banners: HeroBanner[];
  locale: Locale;
}) {
  const [i, setI] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setI((p) => (p + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--r-xl, 24px)",
        overflow: "hidden",
        minHeight: 280,
        border: "1px solid var(--color-border)",
        background:
          "linear-gradient(135deg, var(--color-brand-soft), var(--color-surface))",
      }}
    >
      {banners.map((b, idx) => (
        <div
          key={b.id}
          aria-hidden={idx !== i}
          style={{
            position: idx === 0 ? "relative" : "absolute",
            inset: 0,
            opacity: idx === i ? 1 : 0,
            transition: "opacity 600ms var(--ease-out-expo)",
            display: "grid",
            gridTemplateColumns: b.image ? "1.1fr 1fr" : "1fr",
            alignItems: "center",
          }}
          className="mp-hero-slide"
        >
          <div
            style={{
              padding: "clamp(24px, 4vw, 48px)",
              display: "grid",
              gap: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h2)",
                color: "var(--color-text-strong)",
                lineHeight: 1.1,
              }}
            >
              {localize(b.title, locale)}
            </h2>
            {b.subtitle && (
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-muted)",
                  maxWidth: "46ch",
                  fontSize: "var(--fs-body-lg)",
                }}
              >
                {localize(b.subtitle, locale)}
              </p>
            )}
            {b.href && b.cta && (
              <Link
                href={b.href}
                style={{
                  justifySelf: "start",
                  background: "var(--color-brand)",
                  color: "#fff",
                  borderRadius: "var(--r-pill)",
                  padding: "10px 22px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {localize(b.cta, locale)}
              </Link>
            )}
          </div>
          {b.image && (
            <div
              style={{
                position: "relative",
                alignSelf: "stretch",
                minHeight: 280,
              }}
            >
              <Image
                src={b.image}
                alt=""
                fill
                style={{ objectFit: "cover" }}
                sizes="50vw"
              />
            </div>
          )}
        </div>
      ))}

      {count > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
          }}
        >
          {banners.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setI(idx)}
              style={{
                width: idx === i ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                background:
                  idx === i ? "var(--color-brand)" : "var(--color-border)",
                cursor: "pointer",
                transition: "width 250ms var(--ease-out-expo)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
