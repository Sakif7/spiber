"use client";

import { useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

function subscribe(cb: () => void) {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
}
const serverSnapshot = () => -1;

/**
 * Full-width "limited time offer" band, driven entirely by an admin Deal banner
 * (title / subtitle / CTA / link / image cluster / countdown-to-endsAt). The
 * page only renders it when a Deal banner exists.
 */
export function KartPromo({
  title,
  note,
  cta,
  href = "/kart/shop",
  images = [],
  endsAt,
}: {
  title?: string;
  note?: string;
  cta?: string;
  href?: string;
  images?: string[];
  /** ISO string; when set + future, drives the countdown. */
  endsAt?: string | null;
}) {
  const t = useTranslations("marketplace.promo");

  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  const hasTimer = endMs != null && !Number.isNaN(endMs);

  // Whole seconds left, bucketed so the snapshot is stable within a second.
  const getSnapshot = useCallback(() => {
    if (!hasTimer) return -1;
    return Math.max(0, Math.floor((endMs! - Date.now()) / 1000));
  }, [hasTimer, endMs]);
  const totalSec = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  const ready = hasTimer && totalSec >= 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells: [string, string][] = [
    [ready ? pad(Math.floor(totalSec / 86400)) : "--", t("days")],
    [ready ? pad(Math.floor((totalSec / 3600) % 24)) : "--", t("hours")],
    [ready ? pad(Math.floor((totalSec / 60) % 60)) : "--", t("minutes")],
    [ready ? pad(Math.floor(totalSec % 60)) : "--", t("seconds")],
  ];

  const cluster = images.slice(0, 3);

  return (
    <section id="kart-deals" className="kart-promo-band">
      <div className="kart-promo-wrap">
        <div className="kart-promo-copy">
          <span className="kart-promo-eyebrow">{t("eyebrow")}</span>
          <h2 className="kart-promo-title">{title || t("title")}</h2>
          <p className="kart-promo-note">{note || t("note")}</p>
          {hasTimer && (
            <div className="kart-promo-timer" aria-hidden>
              {cells.map(([v, label], i) => (
                <div key={i} className="kart-promo-cell">
                  <strong>{v}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="kart-promo-side">
          {cluster.length > 0 && (
            <div className="kart-promo-images">
              {cluster.map((src, i) => (
                <span key={i} className="kart-promo-thumb" data-i={i}>
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="140px"
                    style={{ objectFit: "cover" }}
                  />
                </span>
              ))}
            </div>
          )}
          <Link href={href} className="kart-promo-cta">
            {cta || t("cta")}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
