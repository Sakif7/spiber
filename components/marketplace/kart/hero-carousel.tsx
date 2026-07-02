"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type KartBanner = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  href?: string;
  cta?: string;
};

const AUTO_MS = 6000;

/**
 * Full-bleed banner carousel that sits at the very top of the /kart page.
 * Breaks out of the 1240px container with the classic 100vw + margin trick,
 * shows admin banner images edge-to-edge with a left legibility wash, and
 * auto-rotates (paused on hover, disabled under reduced motion). If no banners
 * exist it renders one branded teal fallback slide.
 */
export function KartHeroCarousel({ banners }: { banners: KartBanner[] }) {
  const slides: KartBanner[] =
    banners.length > 0
      ? banners
      : [
          {
            id: "__fallback",
            title: "Everything for health, home and life",
            subtitle:
              "Trusted medical, wellness and everyday essentials, delivered across Bangladesh.",
            href: "/kart/shop",
            cta: "Shop all products",
          },
        ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  // Derived, always-valid active index. Clamping here (rather than in an
  // effect) keeps it correct if the banner set shrinks, without a
  // setState-in-effect.
  const current = count > 0 ? ((index % count) + count) % count : 0;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );
  const prev = useCallback(() => go(current - 1), [go, current]);
  const next = useCallback(() => go(current + 1), [go, current]);

  // Auto-advance: paused on hover, disabled if the user prefers reduced motion.
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const id = window.setTimeout(() => go(current + 1), AUTO_MS);
    return () => window.clearTimeout(id);
  }, [count, paused, reduced, current, go]);

  return (
    <section
      className="kart-heroc"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="kart-heroc-viewport">
        {slides.map((slide, i) => {
          const active = i === current;
          const hasImage = Boolean(slide.image);
          return (
            <div
              key={slide.id}
              className="kart-heroc-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              data-active={active}
              style={{ zIndex: active ? 2 : 1 }}
            >
              {hasImage ? (
                <>
                  <Image
                    src={slide.image!}
                    alt=""
                    fill
                    priority={i === 0}
                    sizes="100vw"
                    style={{ objectFit: "cover" }}
                  />
                  <span className="kart-heroc-wash" aria-hidden />
                </>
              ) : (
                <span className="kart-heroc-fill" aria-hidden />
              )}

              <div className="kart-heroc-inner">
                <div className="kart-heroc-copy">
                  <h2 className="kart-heroc-title">{slide.title}</h2>
                  {slide.subtitle ? (
                    <p className="kart-heroc-sub">{slide.subtitle}</p>
                  ) : null}
                  {slide.href ? (
                    <Link
                      href={slide.href}
                      className="kart-heroc-cta"
                      tabIndex={active ? 0 : -1}
                    >
                      {slide.cta || "Shop now"}
                      <ArrowRight size={17} aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="kart-heroc-arrow kart-heroc-arrow-prev"
            onClick={prev}
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button
            type="button"
            className="kart-heroc-arrow kart-heroc-arrow-next"
            onClick={next}
            aria-label="Next slide"
          >
            <ChevronRight size={22} aria-hidden />
          </button>

          <div
            className="kart-heroc-dots"
            role="group"
            aria-label="Choose slide"
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-current={i === current ? "true" : undefined}
                aria-label={`Go to slide ${i + 1}`}
                className="kart-heroc-dot"
                data-active={i === current}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  const mqRef = useRef<MediaQueryList | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mqRef.current = mq;
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
