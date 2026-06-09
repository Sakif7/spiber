"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type LightboxImage = { url: string; caption?: string };

/**
 * Gallery lightbox — a responsive thumbnail grid that opens a full-screen
 * viewer with prev/next, captions, a counter, backdrop-close, and full keyboard
 * support (Esc, ←/→). Body scroll is locked while open; reduced-motion aware.
 */
export function GalleryLightbox({
  images,
  labels,
}: {
  images: LightboxImage[];
  labels: { close: string; prev: string; next: string };
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const isOpen = open !== null;

  // Lock body scroll while the viewer is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Keyboard navigation.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight")
        setOpen((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === "ArrowLeft")
        setOpen((i) =>
          i === null ? i : (i - 1 + images.length) % images.length,
        );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, images.length]);

  const cur = open !== null ? images[open] : null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--s-3)",
        }}
      >
        {images.map((img, i) => (
          <button
            key={img.url + i}
            type="button"
            onClick={() => setOpen(i)}
            className="gallery-thumb"
            style={{
              position: "relative",
              aspectRatio: "4 / 3",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              border: "1px solid var(--color-hairline)",
              background: "var(--color-surface-2)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Image
              src={img.url}
              alt={img.caption ?? ""}
              fill
              sizes="(max-width: 700px) 50vw, 280px"
              style={{ objectFit: "cover" }}
            />
            {img.caption && (
              <span
                style={{
                  position: "absolute",
                  insetInline: 0,
                  bottom: 0,
                  padding: "18px 12px 8px",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#fff",
                  background:
                    "linear-gradient(180deg, transparent, rgba(7,23,33,0.78))",
                }}
              >
                {img.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {isOpen && cur && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={() => setOpen(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(7,12,15,0.94)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              padding: "clamp(16px, 4vw, 48px)",
            }}
          >
            {/* Close */}
            <IconBtn
              label={labels.close}
              onClick={() => setOpen(null)}
              style={{ position: "absolute", top: 16, right: 16 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconBtn>

            {/* Counter */}
            <span
              style={{
                position: "absolute",
                top: 22,
                left: 22,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {open + 1} / {images.length}
            </span>

            {images.length > 1 && (
              <>
                <IconBtn
                  label={labels.prev}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((i) =>
                      i === null ? i : (i - 1 + images.length) % images.length,
                    );
                  }}
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M15 6l-6 6 6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconBtn>
                <IconBtn
                  label={labels.next}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((i) => (i === null ? i : (i + 1) % images.length));
                  }}
                  style={{
                    position: "absolute",
                    right: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconBtn>
              </>
            )}

            <motion.figure
              key={open}
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: reduce ? 0 : 0.22,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                margin: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                maxWidth: "min(94vw, 1100px)",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "min(94vw, 1100px)",
                  height: "min(80vh, 760px)",
                }}
              >
                <Image
                  src={cur.url}
                  alt={cur.caption ?? ""}
                  fill
                  sizes="94vw"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>
              {cur.caption && (
                <figcaption
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.82)",
                    textAlign: "center",
                    maxWidth: "70ch",
                  }}
                >
                  {cur.caption}
                </figcaption>
              )}
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .gallery-thumb img { transition: transform 500ms cubic-bezier(.16,1,.3,1); }
        .gallery-thumb:hover img { transform: scale(1.05); }
        @media (prefers-reduced-motion: reduce) {
          .gallery-thumb:hover img { transform: none; }
        }
      `}</style>
    </>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  style,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        display: "grid",
        placeItems: "center",
        width: 44,
        height: 44,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
