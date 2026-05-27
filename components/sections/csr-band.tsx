"use client";

import { motion } from "framer-motion";
import {
  Arrow,
  Container,
  Eyebrow,
  Reveal,
  Section,
} from "@/components/ui";

const PILLARS = [
  {
    title: "Devoted to communities",
    body: "Useful products and solutions delivered to the regions of Bangladesh that need them most — from district hospitals to rural diagnostic outposts.",
    tag: "Access",
  },
  {
    title: "Promoting public health",
    body: "Vigorous support for preventive-care programs, screening drives, and partnerships that widen the front door to modern medicine.",
    tag: "Care",
  },
  {
    title: "Dispersing technology",
    body: "Continued investment in advanced equipment so the quality of care does not depend on the postcode of the patient.",
    tag: "Equity",
  },
  {
    title: "Fostering medical talents",
    body: "A knowledge-sharing platform — workshops, residencies, OEM training — that helps Bangladeshi clinicians grow and lead.",
    tag: "Talent",
  },
];

function ManifestoRow({
  index,
  title,
  body,
  tag,
  delay,
}: {
  index: number;
  title: string;
  body: string;
  tag: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <motion.div
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="csr-row"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "auto minmax(220px, 1.1fr) minmax(0, 1.6fr) auto",
          alignItems: "baseline",
          gap: 32,
          padding: "28px 4px",
          borderTop: "1px solid rgba(255,255,255,.10)",
          cursor: "pointer",
        }}
      >
        <motion.span
          variants={{ rest: { color: "rgba(255,255,255,.32)" }, hover: { color: "var(--orange-400)" } }}
          transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(28px, 3vw, 44px)",
            letterSpacing: "-.02em",
            lineHeight: 1,
            width: 64,
          }}
        >
          {String(index).padStart(2, "0")}
        </motion.span>

        <motion.h3
          variants={{ rest: { x: 0 }, hover: { x: 6 } }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "clamp(22px, 2.2vw, 30px)",
            letterSpacing: "-.018em",
            lineHeight: 1.15,
            color: "white",
          }}
        >
          {title}
        </motion.h3>

        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "rgba(255,255,255,.66)",
            maxWidth: "56ch",
          }}
        >
          {body}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            justifySelf: "end",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.5)",
            }}
          >
            {tag}
          </span>
          <motion.span
            variants={{ rest: { x: 0, opacity: 0.6 }, hover: { x: 4, opacity: 1 } }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.18)",
              color: "white",
            }}
          >
            <Arrow size={12} />
          </motion.span>
        </div>
      </motion.div>
    </Reveal>
  );
}

export function CSRBand() {
  return (
    <Section dark mesh>
      <Container>
        <div
          className="csr-head"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
            gap: 72,
            alignItems: "end",
            marginBottom: 72,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <Reveal>
              <Eyebrow dark>CORPORATE SOCIAL RESPONSIBILITY</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "clamp(36px, 4.8vw, 64px)",
                  lineHeight: 1.04,
                  letterSpacing: "-.024em",
                  color: "white",
                  maxWidth: "18ch",
                }}
              >
                Accessible healthcare,{" "}
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--orange-400)",
                  }}
                >
                  at every corner
                </span>{" "}
                of Bangladesh.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,.7)",
                  maxWidth: "52ch",
                }}
              >
                SPIBER aspires to enhance healthcare for all. Our work to be an
                outstanding corporate citizen grows alongside our philosophy —
                year after year, hospital after hospital, district after district.
              </p>
            </Reveal>
          </div>

          <Reveal delay={220}>
            <div
              style={{
                position: "relative",
                paddingLeft: 28,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 4,
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 72,
                  lineHeight: 0.8,
                  color: "var(--orange-400)",
                  opacity: 0.7,
                }}
              >
                &ldquo;
              </span>
              <blockquote
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: "clamp(20px, 1.85vw, 26px)",
                  lineHeight: 1.4,
                  letterSpacing: "-.005em",
                  color: "rgba(255,255,255,.92)",
                }}
              >
                We endeavor to be an outstanding corporate citizen — growing
                every year with the same philosophy that started us.
              </blockquote>
              <footer
                style={{
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 1,
                    background: "rgba(255,255,255,.4)",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.55)",
                  }}
                >
                  From our corporate philosophy
                </span>
              </footer>
            </div>
          </Reveal>
        </div>

        <div className="csr-manifesto" style={{ borderBottom: "1px solid rgba(255,255,255,.10)" }}>
          {PILLARS.map((p, i) => (
            <ManifestoRow
              key={p.title}
              index={i + 1}
              title={p.title}
              body={p.body}
              tag={p.tag}
              delay={i * 90}
            />
          ))}
        </div>

        <Reveal delay={120}>
          <div
            style={{
              marginTop: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.5)",
              }}
            >
              CSR · 2026 COMMITMENT
            </div>
            <motion.a
              href="#csr"
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                textDecoration: "none",
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.22)",
              }}
            >
              Read the full commitment <Arrow size={14} />
            </motion.a>
          </div>
        </Reveal>

        <style>{`
          .csr-row::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background: linear-gradient(90deg, var(--orange-400), transparent 60%);
            transform: scaleX(0);
            transform-origin: left;
            transition: transform .5s cubic-bezier(.2,.7,.2,1);
          }
          .csr-row:hover::after { transform: scaleX(1); }
          .csr-row:last-child { border-bottom: none; }

          @media (max-width: 980px) {
            .csr-head { grid-template-columns: 1fr !important; gap: 36px !important; }
            .csr-row {
              grid-template-columns: auto 1fr auto !important;
              row-gap: 12px !important;
            }
            .csr-row > p { grid-column: 1 / -1; }
          }
          @media (max-width: 600px) {
            .csr-row {
              grid-template-columns: auto 1fr !important;
            }
            .csr-row > div:last-child { grid-column: 2; justify-self: start !important; }
          }
        `}</style>
      </Container>
    </Section>
  );
}
