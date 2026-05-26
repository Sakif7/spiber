"use client";

import { CSSProperties, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Arrow, Container, Reveal } from "@/components/ui";
import { useMagnetic } from "@/hooks";
import DotGrid from "@/components/ui/dot-grid";

// `word` is the noun that follows the static "Empowering " prefix in the
// hero headline; `title` is the source tagline shown in the small indicator
// row above. They are intentionally separate — deriving `word` from `title`
// (e.g. last token) reads nonsensically for taglines like "...Right at Your
// Door" → "Empowering Door."
const HERO_TAGLINES = [
  { word: "Healthcare",  title: "Empowering Healthcare",                line: "SPIBER strives to empower and restore healthcare." },
  { word: "Innovation",  title: "Transforming Healthcare",              line: "Committed to providing cutting-edge technology within reach." },
  { word: "Access",      title: "Cutting-Edge, Right at Your Door",     line: "Assuring innovation across the healthcare industry." },
  { word: "Care",        title: "Uncompromised Medical Care",           line: "Quality products for every stage of medical care." },
  { word: "Skills",      title: "Advancing Academic & Technical Skills",line: "Dazzling professionals with an advanced training system." },
  { word: "Reach",       title: "We Reach, Where Others Can't",         line: "Delivering goods to any location quickly and with ease." },
];

const HERO_PARTNERS = [
  "Mindray", "GE Healthcare", "Philips", "Siemens", "Drager", "Masimo",
  "Edwards", "Stryker", "Olympus", "Karl Storz", "B. Braun", "Fujifilm",
];

function TaglineRotator({ items }: { items: typeof HERO_TAGLINES }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4200);
    return () => clearInterval(t);
  }, [items.length]);

  return (
    <div style={{ position: "relative" }}>
      {/* indicator: 01 / 06 — sliding sub-title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 22,
          height: 22,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--brand-teal)",
            fontSize: 11,
            letterSpacing: ".14em",
          }}
        >
          0{idx + 1} / 0{items.length}
        </span>
        <span style={{ width: 24, height: 1, background: "var(--brand-teal)" }} />
        <div style={{ position: "relative", flex: 1, height: 22, overflow: "hidden" }}>
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                transform: `translateY(${(i - idx) * 100}%)`,
                transition: "transform .7s cubic-bezier(.4,0,0,1)",
              }}
            >
              {t.title}
            </div>
          ))}
        </div>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6.4vw, 92px)",
          fontWeight: 500,
          lineHeight: 0.98,
          letterSpacing: "-0.035em",
          margin: "0 0 8px",
          textWrap: "balance" as CSSProperties["textWrap"],
          color: "var(--color-text-strong)",
        }}
      >
        <span style={{ display: "inline-block" }}>Empowering </span>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            verticalAlign: "baseline",
          }}
        >
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              position: "relative",
              minWidth: 280,
            }}
          >
            {items.map((t, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontStyle: "italic",
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 400,
                  color: "var(--brand-teal)",
                  transform: `translateY(${(i - idx) * 110}%)`,
                  opacity: i === idx ? 1 : 0,
                  transition:
                    "transform .8s cubic-bezier(.4,0,0,1), opacity .5s",
                  position: i === idx ? "static" : "absolute",
                  left: 0,
                  top: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {t.word}.
              </span>
            ))}
          </span>
        </span>
        <br />
        <span>Built for Bangladesh.</span>
      </h1>

      <div
        style={{
          height: 60,
          marginTop: 18,
          position: "relative",
          overflow: "hidden",
          maxWidth: 540,
        }}
      >
        {items.map((t, i) => (
          <p
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              margin: 0,
              fontSize: "clamp(16px, 1.4vw, 20px)",
              lineHeight: 1.55,
              color: "var(--color-text-muted)",
              transform: `translateY(${(i - idx) * 110}%)`,
              transition: "transform .7s cubic-bezier(.4,0,0,1)",
            }}
          >
            {t.line}
          </p>
        ))}
      </div>
    </div>
  );
}

function HeroBackground({ hoveredId }: { hoveredId: string | null }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <DotGrid
        dotSize={3}
        gap={26}
        baseColor="#D2EDEB"
        activeColor="#0E8B86"
        proximity={140}
        style={{ pointerEvents: "auto" }}
      />

      <motion.div
        animate={{ opacity: hoveredId ? 0.12 : 0.45 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hero-blob"
        style={{
          width: 460,
          height: 460,
          top: 60,
          right: -100,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 18%, transparent), transparent 70%)",
          animationDelay: "-8s",
        }}
      />

      {HERO_SOLUTIONS.map((s) => (
        <motion.div
          key={s.id}
          initial={false}
          animate={{ opacity: hoveredId === s.id ? 1 : 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            inset: 0,
          }}
        >
          <Image
            src={s.image}
            alt=""
            fill
            sizes="100vw"
            style={{
              objectFit: "cover",
              objectPosition: "center center",
              filter: "saturate(.85)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, var(--color-surface) 0%, var(--color-surface) 32%, color-mix(in oklab, var(--color-surface) 68%, transparent) 52%, color-mix(in oklab, var(--color-surface) 30%, transparent) 75%, color-mix(in oklab, var(--color-surface) 10%, transparent) 100%)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

type Solution = {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  href: string;
};

const HERO_SOLUTIONS: Solution[] = [
  {
    id: "lab",
    title: "Lab Equipment",
    description:
      "Precision analyzers, microscopes & refrigeration — engineered for clinical and research labs across Bangladesh.",
    image: "/bento-lab-equipment.png",
    imageAlt: "Modern laboratory with microscope, analyzers and glassware",
    imagePosition: "center center",
    href: "#products",
  },
  {
    id: "furniture",
    title: "Medical Furniture",
    description: "Patient beds, OR tables, ICU stations.",
    image: "/bento-furniture.png",
    imageAlt: "Modern hospital beds, exam chairs and OR tables in teal accents",
    imagePosition: "center center",
    href: "#products",
  },
  {
    id: "software",
    title: "Software Solutions",
    description: "HIS, EMR & telemedicine platforms.",
    image: "/bento-software.png",
    imageAlt: "Medical software dashboards on touchscreens and tablets",
    imagePosition: "center center",
    href: "#jupyter",
  },
];

function FeaturedTile({
  s,
  delay,
  onHover,
}: {
  s: Solution;
  delay: number;
  onHover: (id: string | null) => void;
}) {
  return (
    <motion.a
      href={s.href}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover="hover"
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(s.id)}
      onBlur={() => onHover(null)}
      style={{
        position: "relative",
        gridColumn: "1 / span 2",
        borderRadius: 28,
        overflow: "hidden",
        textDecoration: "none",
        color: "white",
        background: "var(--slate-900)",
        boxShadow:
          "0 1px 2px rgba(10,31,44,.05), 0 32px 80px -28px rgba(14,139,134,.32), 0 0 0 1px rgba(14,139,134,.06)",
        display: "block",
        minHeight: 260,
      }}
    >
      <motion.div
        variants={{ hover: { scale: 1.05 } }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Image
          src={s.image}
          alt={s.imageAlt}
          fill
          priority
          sizes="(max-width: 980px) 90vw, 560px"
          style={{
            objectFit: "cover",
            objectPosition: s.imagePosition ?? "center",
          }}
        />
      </motion.div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,8,11,0.0) 0%, rgba(2,8,11,0.15) 38%, rgba(2,8,11,0.78) 100%)",
        }}
      />

      <motion.span
        variants={{ hover: { x: 4 } }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        style={{
          position: "absolute",
          top: 22,
          right: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          color: "var(--color-text-strong)",
        }}
      >
        <Arrow size={14} />
      </motion.span>

      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 22,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "clamp(24px, 2.6vw, 34px)",
            letterSpacing: "-.02em",
            lineHeight: 1.05,
            margin: 0,
            color: "white",
          }}
        >
          {s.title}
        </h3>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 14.5,
            lineHeight: 1.5,
            color: "rgba(255,255,255,.82)",
            maxWidth: "44ch",
          }}
        >
          {s.description}
        </p>
      </div>
    </motion.a>
  );
}

function CompactTile({
  s,
  delay,
  onHover,
}: {
  s: Solution;
  delay: number;
  onHover: (id: string | null) => void;
}) {
  return (
    <motion.a
      href={s.href}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover="hover"
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(s.id)}
      onBlur={() => onHover(null)}
      style={{
        position: "relative",
        borderRadius: 22,
        overflow: "hidden",
        textDecoration: "none",
        color: "white",
        background: "var(--slate-900)",
        boxShadow:
          "0 1px 2px rgba(10,31,44,.05), 0 24px 60px -24px rgba(10,31,44,.24), 0 0 0 1px rgba(10,31,44,.05)",
        display: "block",
        minHeight: 180,
      }}
    >
      <motion.div
        variants={{ hover: { scale: 1.07 } }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Image
          src={s.image}
          alt={s.imageAlt}
          fill
          sizes="(max-width: 980px) 45vw, 280px"
          style={{
            objectFit: "cover",
            objectPosition: s.imagePosition ?? "center",
          }}
        />
      </motion.div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,8,11,0.05) 0%, rgba(2,8,11,0.25) 45%, rgba(2,8,11,0.82) 100%)",
        }}
      />

      <motion.span
        variants={{ hover: { x: 3, y: -3 } }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          color: "var(--color-text-strong)",
        }}
      >
        <Arrow size={12} />
      </motion.span>

      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 14,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 19,
            letterSpacing: "-.012em",
            lineHeight: 1.1,
            margin: 0,
            color: "white",
          }}
        >
          {s.title}
        </h3>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "rgba(255,255,255,.78)",
          }}
        >
          {s.description}
        </p>
      </div>
    </motion.a>
  );
}

function HeroScene({ onHover }: { onHover: (id: string | null) => void }) {
  const [featured, ...compact] = HERO_SOLUTIONS;
  const [hovered, setHovered] = useState<string | null>(null);
  const handleHover = (id: string | null) => {
    setHovered(id);
    onHover(id);
  };
  return (
    <motion.div
      animate={{ opacity: hovered ? 0 : 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      onMouseLeave={() => handleHover(null)}
      style={{
        position: "relative",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridAutoRows: "minmax(180px, auto)",
        gap: 16,
      }}
    >
      <FeaturedTile s={featured} delay={0.2} onHover={handleHover} />
      {compact.map((s, i) => (
        <CompactTile key={s.id} s={s} delay={0.35 + i * 0.1} onHover={handleHover} />
      ))}
    </motion.div>
  );
}

function PartnerMarquee() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        paddingTop: 26,
        marginTop: 80,
        display: "flex",
        overflow: "hidden",
        maskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 64,
          animation: "heroMarquee 40s linear infinite",
          flexShrink: 0,
          paddingRight: 64,
        }}
      >
        {[...HERO_PARTNERS, ...HERO_PARTNERS].map((p, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "var(--color-text-muted)",
              letterSpacing: "-0.01em",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const ctaMag = useMagnetic<HTMLButtonElement>(0.22, 90);
  const [hoveredSolution, setHoveredSolution] = useState<string | null>(null);

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: "clamp(40px, 6vw, 80px)",
        paddingBottom: "clamp(40px, 6vw, 80px)",
        background: "var(--color-surface)",
      }}
    >
      <HeroBackground hoveredId={hoveredSolution} />
      <Container style={{ position: "relative", zIndex: 1 }}>
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
            gap: 56,
            alignItems: "center",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <Reveal>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px 5px 10px",
                borderRadius: 999,
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                fontSize: 11.5,
                fontWeight: 500,
                color: "var(--color-text-strong)",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--brand-teal)",
                  boxShadow:
                    "0 0 0 4px color-mix(in oklab, var(--brand-teal) 22%, transparent)",
                }}
              />
              Healthcare Solutions · Est. 2008 · Dhaka
            </div>

            <TaglineRotator items={HERO_TAGLINES} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 36,
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                ref={ctaMag}
                style={{
                  background: "var(--color-brand)",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "0 18px",
                  height: 44,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow:
                    "0 8px 22px -8px color-mix(in oklab, var(--brand-teal) 60%, transparent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                }}
              >
                Request a Quote <Arrow size={14} />
              </button>
              <button
                style={{
                  background: "transparent",
                  color: "var(--color-text-strong)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 999,
                  padding: "0 18px",
                  height: 44,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                }}
              >
                Explore Solutions
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginLeft: 8,
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-teal)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  ISO 13485
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-teal)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  24×7 biomed
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <HeroScene onHover={setHoveredSolution} />
          </Reveal>
        </div>

        <Reveal>
          <PartnerMarquee />
        </Reveal>
      </Container>
    </section>
  );
}
