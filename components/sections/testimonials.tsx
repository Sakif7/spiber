"use client";

import { useEffect, useState } from "react";
import {
  Arrow,
  Container,
  Placeholder,
  Section,
  SectionTitle,
} from "@/components/ui";
import type { Testimonial } from "@/lib/content-types";

const FALLBACK: Testimonial[] = [
  {
    quote:
      "I have had the pleasure of working with SPIBER MED for all our medical equipment needs, and I can confidently say they are one of the best in the industry. Their commitment to quality, reliability, and customer satisfaction is unmatched. In a field where precision and dependability are non-negotiable, they consistently go above and beyond.",
    name: "Prof. Dr. Md. Moazzem Hossain",
    role: "Chairman · Aichi Healthcare Group",
    tone: "teal",
  },
  {
    quote:
      "A remarkable partner that has earned my confidence in just a few months. Their proactive approach to addressing our needs has been impressive — they understood our requirements from the outset and consistently exceeded expectations.",
    name: "Arpit Ahuja",
    role: "Founder & Director · TOP MRI & Medicto",
    tone: "orange",
  },
  {
    quote:
      "End-to-end delivery on a scale I haven't seen elsewhere in the region. From feasibility study through commissioning and training, the team kept us on schedule and on budget.",
    name: "Dr. Sumaiya Khan",
    role: "Director · Greenlife Specialty Hospital",
    tone: "slate",
  },
];

export function Testimonials({ initial }: { initial?: Testimonial[] }) {
  const [items, setItems] = useState<Testimonial[]>(
    initial && initial.length ? initial : FALLBACK
  );
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (initial && initial.length) return;
    let cancelled = false;
    fetch("/api/testimonials")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { testimonials?: Testimonial[] }) => {
        if (cancelled) return;
        if (data.testimonials && data.testimonials.length) setItems(data.testimonials);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const cur = items[idx];

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 64,
            alignItems: "center",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <SectionTitle
            eyebrow="TESTIMONIAL"
            title="What people say about SPIBER MED."
            lede="A few of the people we work with — chairs of hospital groups, founders of imaging centers, hospital administrators."
          />

          <div style={{ position: "relative" }}>
            <div
              key={idx}
              style={{
                position: "relative",
                minHeight: 380,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-2xl)",
                padding: "44px 48px 32px",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                animation: "tFade 600ms cubic-bezier(.16,1,.3,1)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 18,
                  right: 32,
                  fontSize: 120,
                  lineHeight: 0.8,
                  color: "var(--teal-100)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                }}
              >
                &ldquo;
              </span>

              <div style={{ position: "relative" }}>
                <p
                  style={{
                    margin: "0 0 28px",
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                    fontSize: 22,
                    lineHeight: 1.4,
                    letterSpacing: "-.005em",
                    color: "var(--color-text-strong)",
                    maxWidth: "60ch",
                  }}
                >
                  {cur.quote}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 20,
                    borderTop: "1px solid var(--color-hairline)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Placeholder
                      label=""
                      tone={cur.tone}
                      style={{ width: 52, height: 52, borderRadius: 999, overflow: "hidden" }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {cur.name}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {cur.role}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
                      style={navBtn(false)}
                      aria-label="Previous testimonial"
                    >
                      <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
                        <Arrow size={14} />
                      </span>
                    </button>
                    <button
                      onClick={() => setIdx((i) => (i + 1) % items.length)}
                      style={navBtn(true)}
                      aria-label="Next testimonial"
                    >
                      <Arrow size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "center" }}
            >
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  style={{
                    width: i === idx ? 26 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: i === idx ? "var(--color-brand)" : "var(--slate-300)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 300ms cubic-bezier(.16,1,.3,1)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function navBtn(filled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: filled ? "var(--color-brand)" : "var(--color-surface)",
    color: filled ? "white" : "var(--color-text)",
    border: filled ? "none" : "1px solid var(--color-border)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: filled ? "var(--shadow-brand)" : "none",
    transition: "all 240ms cubic-bezier(.16,1,.3,1)",
  };
}
